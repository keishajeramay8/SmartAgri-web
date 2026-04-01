// functions/index.js

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ===== HELPER: Send notifications to all users in a farm group =====
async function notifyFarmGroupUsers(farmGroupId, notifData) {
  const usersSnap = await db
    .collection("users")
    .where("selectedFarmGroupId", "==", farmGroupId)
    .get();

  if (usersSnap.empty) {
    console.log(`⚠️ No users found for farmGroupId: ${farmGroupId}`);
    return;
  }

  const batch = db.batch();
  usersSnap.forEach((userDoc) => {
    const notifRef = db
      .collection("users")
      .doc(userDoc.id)
      .collection("notifications")
      .doc();

    batch.set(notifRef, {
      ...notifData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    });
  });

  await batch.commit();
  console.log(`✅ Notifications sent to ${usersSnap.size} users.`);
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

// ===== FUNCTION 1: Soil Monitoring + Pump ON/OFF =====
export const smartAgriSoilMonitor = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}",
  async (event) => {
    try {
      const data = event.data.data();

      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;

      const {
        soilMoisture,
        soilStatus,
        growthstage,
        totalVolumeML,
        rainExpected,
        rainDetail,
      } = data;

      console.log(`📌 New reading — Device: ${deviceId}, FarmGroup: ${farmGroupId}`);
      console.log(`Soil: ${soilMoisture}%, Status: ${soilStatus}, Stage: ${growthstage}`);
      console.log(`Volume: ${totalVolumeML} mL, Rain: ${rainExpected}, Detail: ${rainDetail}`);

      // ===== Thresholds =====
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

      // volumeLine is only non-empty on the reading pushed right after
      // pump-OFF, when Arduino sets totalVolumeML = finalVolumeML before
      // calling pushReadingToFirestore(), then resets it to 0 afterward.
      const volumeStr  = formatWater(totalVolumeML);
      const volumeLine = volumeStr
        ? `\n💧 Water dispensed this session: ${volumeStr}`
        : "";

      // ===== Soil moisture alerts =====
      if (soilMoisture < lowerThreshold) {
        await notifyFarmGroupUsers(farmGroupId, {
          title:    "⚠️ Soil Too Dry — Pump ON",
          body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture}%.`
                  + ` Irrigation pump has started.`
                  + volumeLine
                  + `\n${weatherLine}`,
          deviceId: deviceId,
          type:     "alert",
        });
      } else if (soilMoisture > upperThreshold) {
        await notifyFarmGroupUsers(farmGroupId, {
          title:    "💧 Soil Too Wet — Pump OFF",
          body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture}%.`
                  + ` Irrigation pump has stopped.`
                  + volumeLine
                  + `\n${weatherLine}`,
          deviceId: deviceId,
          type:     "alert",
        });
      } else {
        await notifyFarmGroupUsers(farmGroupId, {
          title:    "✅ Soil Optimal — Pump OFF",
          body:     `Device ${deviceId} — Soil moisture is at ${soilMoisture}%.`
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

      const { amountOfWater, duration } = data;

      // Fetch the parent reading to get weather fields
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
      console.log(`Weather: ${weatherLine}`);

      await notifyFarmGroupUsers(farmGroupId, {
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