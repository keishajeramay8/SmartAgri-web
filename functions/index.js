// functions/index.js

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ===================================================================
// HELPER: Send notifications to device owner + farm group admins
// ===================================================================
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
        // Write both field names so the Flutter app works regardless
        // of which field it reads (ESP32 writes "message", FCM uses "body")
        message:   notifData.body ?? notifData.message ?? "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read:      false,
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
    notification: {
      title: notifData.title,
      body:  notifData.body ?? notifData.message ?? "",
    },
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

// ===================================================================
// HELPER: Format water volume
// ===================================================================
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
// FUNCTION 1: ESP32 Device Notifications Forwarder
//
// The ESP32 calls pushNotificationToFirestore() which writes docs to:
//   farmgroups/{farmGroupId}/devices/{deviceId}/notifications
//
// This function listens to that exact path and forwards every document
// to the device owner and farm group admins via FCM push notification.
//
// Notification types sent by the ESP32:
//   DEVICE_ONLINE              — boot, device is ON
//   AUTO_IRRIGATION_PENDING    — step 1: soil dry, irrigation in 5 s
//   IRRIGATION_STARTED         — step 2: relay fired, pump ON
//   AUTO_IRRIGATION_COMPLETED  — step 3: post-absorption complete (AUTO)
//   IRRIGATION_STOPPED         — step 3: post-absorption complete (MANUAL)
//   WEATHER_RAIN               — weather update, rain expected
// ===================================================================
export const smartAgriDeviceNotifications = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/notifications/{notificationId}",
  async (event) => {
    try {
      const data        = event.data.data();
      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;

      // The ESP32 writes: title, message, type, deviceId, read, timestamp
      const title   = data.title   ?? "SmartAgri Alert";
      const message = data.message ?? "";
      const type    = data.type    ?? "update";

      console.log(`📬 ESP32 notification — type=${type} device=${deviceId}`);
      console.log(`   title: ${title}`);
      console.log(`   message: ${message.substring(0, 120)}`);

      // Forward to all eligible users
      await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
        title,
        body:     message,   // FCM uses "body"; helper also writes "message"
        message,             // keep for Flutter compatibility
        deviceId,
        type,
      });

    } catch (err) {
      console.error("❌ Error in smartAgriDeviceNotifications:", err);
    }
  }
);

// ===================================================================
// FUNCTION 2: Soil Monitoring + Pump ON/OFF + Weather + Device On
//
// Triggered by: ESP32 → pushReadingToFirestore()
// Path: farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}
//
// NOTE: This function now only handles CHANGE-BASED notifications that
// are NOT already sent by the ESP32 via the /notifications path.
// The ESP32 sends its own step-by-step notifications for irrigation
// events. This function handles soil status changes and weather changes
// that the ESP32 does not explicitly notify about.
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

      // ── Change detection ────────────────────────────────────────────
      // Skip device-on detection here — the ESP32 sends DEVICE_ONLINE
      // itself via /notifications, which Function 1 already forwards.
      const soilStatusChanged = lastSoilStatus !== null && lastSoilStatus !== soilStatus;
      const pumpStateChanged  = lastPumpState  !== null && lastPumpState  !== pumpState;
      const weatherChanged    = lastRainExpected !== null
                              && (lastRainExpected !== rainExpected || lastRainDetail !== rainDetail);

      console.log(`soilChanged: ${soilStatusChanged}, pumpChanged: ${pumpStateChanged}, weatherChanged: ${weatherChanged}`);

      // ── Persist state ───────────────────────────────────────────────
      await setLastState(farmGroupId, deviceId, {
        soilStatus,
        pumpState,
        rainExpected,
        rainDetail,
        lastReadingId: readingId,
      });

      // ── Shared helpers ──────────────────────────────────────────────
      const wLine     = buildWaterLine(lastSessionVolumeML, totalVolumeML);
      const weatherLn = formatWeather(rainExpected, rainDetail);
      const modeLabel = irrigationMode === "MANUAL" ? "Manual" : "Auto";

      // Thresholds per growth stage (underscored, matching ESP32 values)
      let lowerThreshold = 0;
      let upperThreshold = 0;
      switch (growthstage) {
        case "VEGETATIVE":     lowerThreshold = 16; upperThreshold = 22; break;
        case "BUD_FORMATION":  lowerThreshold = 18; upperThreshold = 25; break;
        case "FLOWERING":      lowerThreshold = 20; upperThreshold = 25; break;
        case "POST_FLOWERING": lowerThreshold = 12; upperThreshold = 19; break;
        default:               lowerThreshold = 18; upperThreshold = 30;
      }

      // ── RULE 1: Soil status changed ─────────────────────────────────
      // Skip if pump is on AND soil is Dry — the ESP32 already sent
      // AUTO_IRRIGATION_PENDING + IRRIGATION_STARTED for this transition.
      if (soilStatusChanged) {
        if (soilMoisture < lowerThreshold) {
          // Only notify here if the pump did NOT just turn on
          // (if it did, the ESP32 already sent the irrigation notifications)
          if (!pumpStateChanged) {
            await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
              title: pumpState ? "⚠️ Soil Too Dry — Pump ON" : "⚠️ Soil Too Dry — Pump OFF",
              body:  `Device ${deviceId} — Soil moisture dropped to ${soilMoisture.toFixed(1)}%.\n`
                   + (pumpState
                       ? `Irrigation pump (${modeLabel}) is running.`
                       : `Pump is off — consider starting irrigation.`)
                   + wLine
                   + `\n${weatherLn}`,
              deviceId,
              type: "alert",
            });
          }
        } else if (soilMoisture > upperThreshold) {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: "💧 Soil Too Wet — Pump OFF",
            body:  `Device ${deviceId} — Soil moisture rose to ${soilMoisture.toFixed(1)}%.\n`
                 + `Irrigation pump has stopped.`
                 + wLine
                 + `\n${weatherLn}`,
            deviceId,
            type: "alert",
          });
        } else {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: "✅ Soil Optimal",
            body:  `Device ${deviceId} — Soil moisture is now ${soilMoisture.toFixed(1)}% (optimal).`
                 + wLine
                 + `\n${weatherLn}`,
            deviceId,
            type: "update",
          });
        }
      }

      // ── RULE 2: Pump state changed ──────────────────────────────────
      // Skip if the ESP32 already sent its own irrigation notifications
      // (it always sends AUTO_IRRIGATION_PENDING → IRRIGATION_STARTED
      // before turning the pump on, so duplicate pump-on notifications
      // from here are suppressed).
      // We still fire pump-off here when it wasn't caught by ESP32
      // (e.g. soil reached Optimal/Wet mid-cycle without a reading gap).
      if (pumpStateChanged && !pumpState) {
        // Pump turned OFF — only notify if it wasn't caught by
        // AUTO_IRRIGATION_COMPLETED / IRRIGATION_STOPPED (those fire
        // post-absorption, so there is a small window this can add value)
        if (!soilStatusChanged) {
          await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
            title: `🛑 Irrigation Stopped (${modeLabel})`,
            body:  `Device ${deviceId} — ${modeLabel} irrigation has stopped.\n`
                 + `💧 Soil moisture: ${soilMoisture.toFixed(1)}%`
                 + `\n${weatherLn}`,
            deviceId,
            type: "irrigation",
          });
        }
      }

      // ── RULE 3: Weather changed (only if nothing else fired) ────────
      if (!soilStatusChanged && !pumpStateChanged && weatherChanged) {
        await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
          title: rainExpected ? "🌧️ Weather Update — Rain Expected" : "☀️ Weather Update — No Rain",
          body:  `Device ${deviceId} — Weather forecast updated.\n${weatherLn}`,
          deviceId,
          type: "weather",
        });
      }

    } catch (err) {
      console.error("❌ Error in smartAgriSoilMonitor:", err);
    }
  }
);

// ===================================================================
// FUNCTION 3: Irrigation Completed
//
// Triggered by: ESP32 → pushIrrigationToFirestore() /
//               pushStandaloneIrrigationToFirestore()
// Path: farmgroups/{farmGroupId}/devices/{deviceId}/irrigation/{irrigationId}
//
// NOTE: The ESP32 ALSO sends AUTO_IRRIGATION_COMPLETED / IRRIGATION_STOPPED
// via /notifications (Function 1). This function therefore only fires
// for cases where the irrigation doc has extra detail not in the
// notification (duration, water volume formatted nicely). Both will
// arrive at the user — the ESP32 notification is the "immediate" one,
// this one is the "detailed summary". If you want only one, set
// ENABLE_IRRIGATION_COMPLETE_SUMMARY = false below.
// ===================================================================
const ENABLE_IRRIGATION_COMPLETE_SUMMARY = false; // set true if you want a second detailed push

export const smartAgriIrrigationComplete = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/irrigation/{irrigationId}",
  async (event) => {
    if (!ENABLE_IRRIGATION_COMPLETE_SUMMARY) {
      console.log("ℹ️ Irrigation complete summary disabled — ESP32 already notified via /notifications");
      return;
    }

    try {
      const data = event.data.data();

      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;

      const amountOfWater  = data.amountOfWater  ?? data.waterAmount ?? 0;
      const duration       = data.duration       ?? 0;
      const irrigationMode = data.irrigationMode ?? data.mode ?? "AUTO";
      const modeLabel      = irrigationMode === "MANUAL" ? "Manual" : "Auto";

      const rainExpected = data.rainExpected ?? false;
      const rainDetail   = data.rainDetail   ?? "";
      const soilMoisture = data.soilMoisture ?? null;
      const soilStatus   = data.soilStatus   ?? null;

      const durationMin = Math.floor(duration / 60);
      const durationSec = duration % 60;
      const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;

      const waterStr    = formatWater(amountOfWater) ?? "N/A";
      const weatherLine = formatWeather(rainExpected, rainDetail);

      console.log(`💦 Irrigation complete — Device: ${deviceId}, Volume: ${waterStr}, Duration: ${durationStr}`);

      const soilLine = soilMoisture != null
        ? `\n💧 Soil moisture after: ${soilMoisture.toFixed(1)}%` + (soilStatus ? ` (${soilStatus})` : "")
        : "";

      await notifyFarmGroupDeviceUsers(farmGroupId, deviceId, {
        title: `✅ Irrigation Completed (${modeLabel})`,
        body:  `Device ${deviceId} — ${modeLabel} irrigation finished.\n`
             + `🪣 Water delivered: ${waterStr}\n`
             + `⏱ Duration: ${durationStr}`
             + soilLine
             + `\n${weatherLine}`,
        deviceId,
        type: "irrigation",
      });

    } catch (err) {
      console.error("❌ Error in smartAgriIrrigationComplete:", err);
    }
  }
);