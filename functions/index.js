// functions/index.js

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ===== HELPER: Send notifications only to device owner + farm group admins =====
async function notifyFarmGroupDeviceUsers(farmGroupId, deviceId, notifData) {
  console.log(`🔍 notifyFarmGroupDeviceUsers — farmGroupId=${farmGroupId} deviceId=${deviceId}`);

  // 1. Get the device doc to find the owner (createdBy field)
  const deviceSnap = await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("devices").doc(deviceId)
    .get();

  if (!deviceSnap.exists) {
    console.log(`⚠️ Device doc not found at farmgroups/${farmGroupId}/devices/${deviceId}`);
    return;
  }

  const deviceData = deviceSnap.data();
  const createdBy  = deviceData.createdBy ?? null;
  console.log(`📱 Device doc found — createdBy=${createdBy}`);

  // 2. Build eligible UIDs set using TWO sources so no one is missed:
  //    Source A — members subcollection (device owner)
  //    Source B — users collection queried by selectedFarmGroupId + role=admin
  const eligibleUids = new Set();

  // ── Source A: members subcollection → pick up the device owner ──────
  const membersSnap = await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("members")
    .get();

  console.log(`👥 Found ${membersSnap.size} members in farmgroup`);

  membersSnap.forEach((memberDoc) => {
    const uid           = memberDoc.id;
    const isDeviceOwner = uid === createdBy;
    if (isDeviceOwner) {
      console.log(`✅ Device owner found in members — uid=${uid}`);
      eligibleUids.add(uid);
    }
  });

  // ── Source B: users with selectedFarmGroupId + role=admin ───────────
  const adminsSnap = await db
    .collection("users")
    .where("selectedFarmGroupId", "==", farmGroupId)
    .where("role", "==", "admin")
    .get();

  console.log(`👑 Found ${adminsSnap.size} admin(s) with selectedFarmGroupId=${farmGroupId}`);

  adminsSnap.forEach((userDoc) => {
    console.log(`✅ Admin found — uid=${userDoc.id}`);
    eligibleUids.add(userDoc.id);
  });

  if (eligibleUids.size === 0) {
    console.log(`⚠️ No eligible users to notify`);
    return;
  }

  console.log(`📋 Eligible UIDs: ${[...eligibleUids].join(", ")}`);

  // 3. For each eligible user:
  //    a) Write Firestore notification doc  → picked up by the WEB app
  //    b) Fetch FCM token and queue push    → picked up by the MOBILE app
  const batch       = db.batch();
  const fcmMessages = [];

  await Promise.all(
    [...eligibleUids].map(async (uid) => {
      // ── WEB: Firestore notifications subcollection ───────────────────
      const notifRef = db
        .collection("users").doc(uid)
        .collection("notifications").doc();

      batch.set(notifRef, {
        ...notifData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
      console.log(`🔔 Queued Firestore notification for uid=${uid}`);

      // ── MOBILE: fetch FCM token from users/{uid} doc ─────────────────
      try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) {
          console.log(`⚠️ User doc not found for uid=${uid} — skipping FCM`);
          return;
        }

        const userData = userSnap.data();
        const fcmToken = userData.fcmToken ?? userData.pushToken ?? null;

        if (!fcmToken) {
          console.log(`⚠️ No FCM token for uid=${uid} — skipping mobile push`);
          return;
        }

        fcmMessages.push({ token: fcmToken, uid });
        console.log(`📲 Queued FCM push for uid=${uid}`);
      } catch (err) {
        console.error(`❌ Failed to fetch FCM token for uid=${uid}:`, err);
      }
    })
  );

  // 4. Commit Firestore batch → notifies WEB
  await batch.commit();
  console.log(`✅ Firestore notifications written for ${eligibleUids.size} users (web).`);

  // 5. Send FCM push messages → notifies MOBILE
  if (fcmMessages.length === 0) {
    console.log(`⚠️ No FCM tokens found — mobile push skipped.`);
    return;
  }

  const fcmPayloads = fcmMessages.map(({ token }) => ({
    token,
    notification: {
      title: notifData.title,
      body:  notifData.body,
    },
    data: {
      deviceId: notifData.deviceId ?? "",
      type:     notifData.type     ?? "update",
    },
    android: {
      priority: "high",
      notification: { sound: "default" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
    },
  }));

  const fcmResponse = await admin.messaging().sendEach(fcmPayloads);
  console.log(`📲 FCM — success: ${fcmResponse.successCount}, failed: ${fcmResponse.failureCount}`);

  // Auto-remove invalid/expired tokens so they don't accumulate
  fcmResponse.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const { uid } = fcmMessages[idx];
      const errCode = resp.error?.code ?? "unknown";
      console.error(`❌ FCM failed for uid=${uid}: ${errCode}`);

      if (
        errCode === "messaging/invalid-registration-token" ||
        errCode === "messaging/registration-token-not-registered"
      ) {
        db.collection("users").doc(uid)
          .update({ fcmToken: admin.firestore.FieldValue.delete() })
          .then(() => console.log(`🗑️ Removed stale FCM token for uid=${uid}`))
          .catch((e) => console.error(`❌ Failed to remove token for uid=${uid}:`, e));
      }
    }
  });
}

// ===== HELPER: Format water volume =====
function formatWater(ml) {
  if (ml == null || ml === 0) return null;
  return ml >= 1000
    ? `${(ml / 1000).toFixed(2)} L`
    : `${ml.toFixed(1)} mL`;
}

// ===== HELPER: Format weather line =====
function formatWeather(rainExpected, rainDetail) {
  if (rainExpected) {
    const detail = rainDetail && rainDetail !== "none" ? ` (${rainDetail})` : "";
    return `🌧️ Rain expected today${detail}`;
  }
  return "☀️ No rain expected";
}

// ===================================================================
// THROTTLE HELPER — prevents a notification flood since Arduino pushes
// a reading every second. We only send a notification when the soil
// status CHANGES (Dry → Optimal, Optimal → Wet, etc.), not on every
// reading.
// ===================================================================
async function getLastStatus(farmGroupId, deviceId) {
  const snap = await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("devices").doc(deviceId)
    .collection("_notif_state").doc("lastStatus")
    .get();
  return snap.exists ? (snap.data().status ?? null) : null;
}

async function setLastStatus(farmGroupId, deviceId, status) {
  await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("devices").doc(deviceId)
    .collection("_notif_state").doc("lastStatus")
    .set({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
}

// ===== FUNCTION 1: Soil Monitoring + Pump ON/OFF =====
export const smartAgriSoilMonitor = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}",
  async (event) => {
    try {
      const data = event.data.data();

      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;

      const soilMoisture  = data.soilMoisture  ?? null;
      const soilStatus    = data.soilStatus    ?? null;
      const growthstage   = data.growthstage   ?? "UNKNOWN";
      const totalVolumeML = data.totalVolumeML ?? 0;
      const pumpState     = data.pumpState     ?? false;
      const rainExpected  = data.rainExpected  ?? false;
      const rainDetail    = data.rainDetail    ?? "";

      console.log(`📌 New reading — Device: ${deviceId}, FarmGroup: ${farmGroupId}`);
      console.log(`Soil: ${soilMoisture}%, Status: ${soilStatus}, Stage: ${growthstage}`);
      console.log(`Pump: ${pumpState}, Volume: ${totalVolumeML} mL, Rain: ${rainExpected}, Detail: ${rainDetail}`);

      if (soilMoisture == null || soilStatus == null) {
        console.log(`⚠️ Missing soilMoisture or soilStatus — skipping`);
        return;
      }

      // ── THROTTLE: only notify on status change ───────────────────────
      const lastStatus = await getLastStatus(farmGroupId, deviceId);
      console.log(`📊 lastStatus=${lastStatus}  currentStatus=${soilStatus}`);

      if (lastStatus === soilStatus) {
        console.log(`⏭️  Status unchanged (${soilStatus}) — skipping notification`);
        return;
      }

      await setLastStatus(farmGroupId, deviceId, soilStatus);
      console.log(`🔄 Status changed: ${lastStatus} → ${soilStatus}`);

      // ── Thresholds ───────────────────────────────────────────────────
      let lowerThreshold = 0;
      let upperThreshold = 0;

      switch (growthstage) {
        case "VEGETATIVE":     lowerThreshold = 16; upperThreshold = 22; break;
        case "BUD FORMATION":  lowerThreshold = 18; upperThreshold = 25; break;
        case "FLOWERING":      lowerThreshold = 20; upperThreshold = 25; break;
        case "POST FLOWERING": lowerThreshold = 12; upperThreshold = 19; break;
        default:               lowerThreshold = 18; upperThreshold = 30;
      }

      const weatherLine = formatWeather(rainExpected, rainDetail);
      const volumeStr   = formatWater(totalVolumeML);
      const volumeLine  = volumeStr
        ? `\n💧 Water dispensed this session: ${volumeStr}`
        : "";

      if (soilMoisture < lowerThreshold) {
        if (pumpState) {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title:    "⚠️ Soil Too Dry — Pump ON",
            body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture.toFixed(1)}%.`
                    + ` Irrigation pump has started.`
                    + volumeLine
                    + `\n${weatherLine}`,
            deviceId: deviceId,
            type:     "alert",
          });
        } else {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title:    "⚠️ Soil Too Dry — Pump OFF",
            body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture.toFixed(1)}%.`
                    + ` Pump was manually stopped.`
                    + volumeLine
                    + `\n${weatherLine}`,
            deviceId: deviceId,
            type:     "alert",
          });
        }
      } else if (soilMoisture > upperThreshold) {
        await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
          title:    "💧 Soil Too Wet — Pump OFF",
          body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture.toFixed(1)}%.`
                  + ` Irrigation pump has stopped.`
                  + volumeLine
                  + `\n${weatherLine}`,
          deviceId: deviceId,
          type:     "alert",
        });
      } else {
        await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
          title:    "✅ Soil Optimal — Pump OFF",
          body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture.toFixed(1)}%.`
                  + ` Pump turned off, soil is optimal.`
                  + volumeLine
                  + `\n${weatherLine}`,
          deviceId: deviceId,
          type:     "update",
        });
      }

    } catch (err) {
      console.error("❌ Error in smartAgriSoilMonitor:", err);
    }
  }
);

// ===== FUNCTION 2: Irrigation Completed =====
export const smartAgriIrrigationComplete = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}/irrigations/{irrigationId}",
  async (event) => {
    try {
      const data = event.data.data();

      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;
      const readingId   = event.params.readingId;

      const amountOfWater = data.amountOfWater ?? 0;
      const duration      = data.duration      ?? 0;

      const readingSnap = await db
        .collection("farmgroups").doc(farmGroupId)
        .collection("devices").doc(deviceId)
        .collection("readings").doc(readingId)
        .get();

      const readingData  = readingSnap.exists ? readingSnap.data() : {};
      const rainExpected = readingData.rainExpected ?? false;
      const rainDetail   = readingData.rainDetail   ?? "";

      const durationMin = Math.floor(duration / 60);
      const durationSec = duration % 60;
      const durationStr = durationMin > 0
        ? `${durationMin}m ${durationSec}s`
        : `${durationSec}s`;

      const waterStr    = formatWater(amountOfWater) ?? "N/A";
      const weatherLine = formatWeather(rainExpected, rainDetail);

      console.log(`💦 Irrigation complete — Device: ${deviceId}, Volume: ${waterStr}, Duration: ${durationStr}`);

      await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
        title: "💦 Irrigation Completed",
        body:  `Device ${deviceId} — Irrigation finished.\n`
             + `🪣 Water used: ${waterStr}\n`
             + `⏱ Duration: ${durationStr}\n`
             + `${weatherLine}`,
        deviceId: deviceId,
        type:     "update",
      });

    } catch (err) {
      console.error("❌ Error in smartAgriIrrigationComplete:", err);
    }
  }
);