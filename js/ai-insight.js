function getAIInsight(suhu, aqi) {
  if (suhu > 30 && aqi > 100) return "⚠️ Hati-hati, kondisi lingkungan kurang sehat!";
  if (suhu > 30) return "🔥 Suhu tinggi, tetap terhidrasi.";
  if (aqi > 100) return "🌫️ Kualitas udara buruk, gunakan masker.";
  return "✅ Lingkungan aman dan nyaman.";
}
