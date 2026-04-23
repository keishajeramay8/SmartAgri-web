// functions/index.js

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ===== HELPER: Send notifications only to device owner + farm group admins =====
async function notifyFarmGroupDeviceUsers(farmGroupId, deviceId, notifData) {
  console.log(`🔍 notifyFarmGroupDeviceUsers — farmGroupId=${farmGroupId} deviceId=${deviceId}`);

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

  const eligibleUids = new Set();

  const membersSnap = await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("members")
    .get();

  membersSnap.forEach((memberDoc) => {
    if (memberDoc.id === createdBy) {
      console.log(`✅ Device owner — uid=${memberDoc.id}`);
      eligibleUids.add(memberDoc.id);
    }
  });

  const adminsSnap = await db
    .collection("users")
    .where("selectedFarmGroupId", "==", farmGroupId)
    .where("role", "==", "admin")
    .get();

  adminsSnap.forEach((userDoc) => {
    console.log(`✅ Admin — uid=${userDoc.id}`);
    eligibleUids.add(userDoc.id);
  });

  if (eligibleUids.size === 0) {
    console.log(`⚠️ No eligible users to notify`);
    return;
  }

  const batch       = db.batch();
  const fcmMessages = [];

  await Promise.all(
    [...eligibleUids].map(async (uid) => {
      const notifRef = db.collection("users").doc(uid).collection("notifications").doc();
      batch.set(notifRef, {
        ...notifData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) return;
        const fcmToken = userSnap.data().fcmToken ?? userSnap.data().pushToken ?? null;
        if (fcmToken) fcmMessages.push({ token: fcmToken, uid });
      } catch (err) {
        console.error(`❌ Failed to fetch FCM token for uid=${uid}:`, err);
      }
    })
  );

  await batch.commit();
  console.log(`✅ Firestore notifications written for ${eligibleUids.size} users.`);

  if (fcmMessages.length === 0) return;

  const fcmPayloads = fcmMessages.map(({ token }) => ({
    token,
    notification: { title: notifData.title, body: notifData.body },
    data: {
      deviceId: notifData.deviceId ?? "",
      type:     notifData.type     ?? "update",
    },
    android: { priority: "high", notification: { sound: "default" } },
    apns:    { payload: { aps: { sound: "default", badge: 1 } } },
  }));

  const fcmResponse = await admin.messaging().sendEach(fcmPayloads);
  console.log(`📲 FCM — success: ${fcmResponse.successCount}, failed: ${fcmResponse.failureCount}`);

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

function buildWaterLine(lastSessionVolumeML, totalVolumeML) {
  const ml  = (lastSessionVolumeML > 0) ? lastSessionVolumeML : totalVolumeML;
  const str = formatWater(ml);
  return str ? `\n🪣 Water irrigated this session: ${str}` : "";
}

function formatWeather(rainExpected, rainDetail) {
  if (rainExpected) {
    const detail = rainDetail && rainDetail !== "none" ? ` (${rainDetail})` : "";
    return `🌧️ Rain expected today${detail}`;
  }
  return "☀️ No rain expected";
}

// ===================================================================
// STATE HELPERS
// ===================================================================
const DEVICE_GAP_MINUTES = 10;

async function getLastState(farmGroupId, deviceId) {
  const snap = await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("devices").doc(deviceId)
    .collection("_notif_state").doc("lastState")
    .get();

  if (!snap.exists) {
    return {
      soilStatus:    null,
      pumpState:     null,
      rainExpected:  null,
      rainDetail:    null,
      lastReadingId: null,
      lastSeenAt:    null,
    };
  }

  const d = snap.data();
  return {
    soilStatus:    d.soilStatus    ?? null,
    pumpState:     d.pumpState     ?? null,
    rainExpected:  d.rainExpected  ?? null,
    rainDetail:    d.rainDetail    ?? null,
    lastReadingId: d.lastReadingId ?? null,
    lastSeenAt:    d.lastSeenAt?.toDate?.() ?? null,
  };
}

async function setLastState(farmGroupId, deviceId, fields) {
  await db
    .collection("farmgroups").doc(farmGroupId)
    .collection("devices").doc(deviceId)
    .collection("_notif_state").doc("lastState")
    .set({
      ...fields,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });
}

// ===================================================================
// FUNCTION 1: Soil Monitoring + Pump ON/OFF + Weather + Device On
// ===================================================================
export const smartAgriSoilMonitor = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}",
  async (event) => {
    try {
      const data = event.data.data();

      const readingId   = event.params.readingId;
      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;

      const soilMoisture        = data.soilMoisture        ?? null;
      const soilStatus          = data.soilStatus          ?? null;
      const growthstage         = data.growthstage         ?? "UNKNOWN";
      const pumpState           = data.pumpState           ?? false;
      const rainExpected        = data.rainExpected        ?? false;
      const rainDetail          = data.rainDetail          ?? "";
      const irrigationMode      = data.irrigationMode      ?? "AUTO";
      const totalVolumeML       = data.totalVolumeML       ?? 0;
      const lastSessionVolumeML = data.lastSessionVolumeML ?? 0;

      console.log(`📌 Reading — Device: ${deviceId}, ReadingId: ${readingId}`);
      console.log(`Soil: ${soilMoisture}%, Status: ${soilStatus}, Pump: ${pumpState}`);

      if (soilMoisture == null || soilStatus == null) {
        console.log(`⚠️ Missing soilMoisture or soilStatus — skipping`);
        return;
      }

      const lastState = await getLastState(farmGroupId, deviceId);
      const {
        soilStatus:   lastSoilStatus,
        pumpState:    lastPumpState,
        rainExpected: lastRainExpected,
        rainDetail:   lastRainDetail,
        lastSeenAt,
      } = lastState;

      // ── Device turned on detection ───────────────────────────────────
      const nowMs      = Date.now();
      const gapMs      = DEVICE_GAP_MINUTES * 60 * 1000;
      const isDeviceOn = !lastSeenAt || (nowMs - lastSeenAt.getTime()) > gapMs;

      // ── Change detection ─────────────────────────────────────────────
      // FIX: treat null → false as NOT a change (first reading after boot)
      const soilStatusChanged = lastSoilStatus !== null && lastSoilStatus !== soilStatus;
      const pumpStateChanged  = lastPumpState  !== null && lastPumpState  !== pumpState;
      const weatherChanged    = lastRainExpected !== null
                              && (lastRainExpected !== rainExpected || lastRainDetail !== rainDetail);

      console.log(`isDeviceOn: ${isDeviceOn}, soilChanged: ${soilStatusChanged}, pumpChanged: ${pumpStateChanged}, weatherChanged: ${weatherChanged}`);

      // ── Persist state ────────────────────────────────────────────────
      await setLastState(farmGroupId, deviceId, {
        soilStatus,
        pumpState,
        rainExpected,
        rainDetail,
        lastReadingId: readingId,
      });

      // ── Shared helpers ───────────────────────────────────────────────
      const wLine     = buildWaterLine(lastSessionVolumeML, totalVolumeML);
      const weatherLn = formatWeather(rainExpected, rainDetail);
      const modeLabel = irrigationMode === "MANUAL" ? "Manual" : "Auto";

      let lowerThreshold = 0;
      let upperThreshold = 0;
      switch (growthstage) {
        case "VEGETATIVE":     lowerThreshold = 16; upperThreshold = 22; break;
        case "BUD FORMATION":  lowerThreshold = 18; upperThreshold = 25; break;
        case "FLOWERING":      lowerThreshold = 20; upperThreshold = 25; break;
        case "POST FLOWERING": lowerThreshold = 12; upperThreshold = 19; break;
        default:               lowerThreshold = 18; upperThreshold = 30;
      }

      // ================================================================
      // NOTIFICATION RULES — mutually exclusive priority order:
      //   Rule 1 (device on)  → fires alone, suppresses all others
      //   Rule 2 (soil)       → fires only if device NOT just turned on
      //   Rule 3 (pump)       → fires only if device NOT just turned on
      //   Rule 4 (weather)    → fires only if none of the above fired
      // ================================================================

      // ── RULE 1: Device turned on — covers soil + weather in its body ─
      if (isDeviceOn) {
        await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
          title:    `🟢 Device Online`,
          body:     `Device ${deviceId} is now online.\n`
                  + `💧 Soil moisture: ${soilMoisture.toFixed(1)}% (${soilStatus})`
                  + wLine
                  + `\n${weatherLn}`,
          deviceId, type: "device",
        });
        // Rule 1 fired — stop here so Rules 2/3/4 don't double-notify
        return;
      }

      // ── RULE 2: Soil status changed ──────────────────────────────────
      if (soilStatusChanged) {
        if (soilMoisture < lowerThreshold) {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: pumpState ? "⚠️ Soil Too Dry — Pump ON" : "⚠️ Soil Too Dry — Pump OFF",
            body:  `Device ${deviceId} — Soil moisture dropped to ${soilMoisture.toFixed(1)}%.\n`
                 + (pumpState
                     ? `Irrigation pump (${modeLabel}) has started.`
                     : `Pump is off — consider starting irrigation.`)
                 + wLine
                 + `\n${weatherLn}`,
            deviceId, type: "alert",
          });
        } else if (soilMoisture > upperThreshold) {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: "💧 Soil Too Wet — Pump OFF",
            body:  `Device ${deviceId} — Soil moisture rose to ${soilMoisture.toFixed(1)}%.\n`
                 + `Irrigation pump has stopped.`
                 + wLine
                 + `\n${weatherLn}`,
            deviceId, type: "alert",
          });
        } else {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: "✅ Soil Optimal",
            body:  `Device ${deviceId} — Soil moisture is now ${soilMoisture.toFixed(1)}% (optimal).`
                 + wLine
                 + `\n${weatherLn}`,
            deviceId, type: "update",
          });
        }
      }

      // ── RULE 3: Pump state flipped (independent of soil status change) ─
      // Only fires when pumpState genuinely changed, not on first reading
      if (pumpStateChanged) {
        if (pumpState) {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: `🚿 Irrigation Started (${modeLabel})`,
            body:  `Device ${deviceId} — ${modeLabel} irrigation has started.\n`
                 + `💧 Soil moisture: ${soilMoisture.toFixed(1)}%`
                 + wLine
                 + `\n${weatherLn}`,
            deviceId, type: "irrigation",
          });
        } else {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: `🛑 Irrigation Stopped (${modeLabel})`,
            body:  `Device ${deviceId} — ${modeLabel} irrigation has stopped.\n`
                 + `💧 Soil moisture: ${soilMoisture.toFixed(1)}%`
                 + wLine
                 + `\n${weatherLn}`,
            deviceId, type: "irrigation",
          });
        }
      }

      // ── RULE 4: Weather changed — only if no other rule fired ────────
      if (!soilStatusChanged && !pumpStateChanged && weatherChanged) {
        await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
          title: rainExpected ? "🌧️ Weather Update — Rain Expected" : "☀️ Weather Update — No Rain",
          body:  `Device ${deviceId} — Weather forecast updated.\n${weatherLn}`,
          deviceId, type: "weather",
        });
      }

    } catch (err) {
      console.error("❌ Error in smartAgriSoilMonitor:", err);
    }
  }
);

// ===================================================================
// FUNCTION 2: Irrigation Completed
// ===================================================================
export const smartAgriIrrigationComplete = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}/irrigations/{irrigationId}",
  async (event) => {
    try {
      const data = event.data.data();

      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;
      const readingId   = event.params.readingId;

      const amountOfWater  = data.amountOfWater  ?? 0;
      const duration       = data.duration       ?? 0;
      const irrigationMode = data.irrigationMode ?? "AUTO";
      const modeLabel      = irrigationMode === "MANUAL" ? "Manual" : "Auto";

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
      const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;

      const waterStr    = formatWater(amountOfWater) ?? "N/A";
      const weatherLine = formatWeather(rainExpected, rainDetail);

      console.log(`💦 Irrigation complete — Device: ${deviceId}, Volume: ${waterStr}, Duration: ${durationStr}`);

      await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
        title: `💦 Irrigation Completed (${modeLabel})`,
        body:  `Device ${deviceId} — ${modeLabel} irrigation finished.\n`
             + `🪣 Water used: ${waterStr}\n`
             + `⏱ Duration: ${durationStr}\n`
             + `${weatherLine}`,
        deviceId, type: "update",
      });

    } catch (err) {
      console.error("❌ Error in smartAgriIrrigationComplete:", err);
    }
  }
);