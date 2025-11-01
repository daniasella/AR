const btnCamera = document.getElementById("btnCamera");
const arSection = document.getElementById("ar-section");
const scannerText = document.querySelector("#scanner p");
const modelViewer = document.querySelector("model-viewer");

btnCamera.addEventListener("click", () => {
  arSection.classList.remove("hidden");
  scannerText.innerText = "🔍 Memindai lingkungan sekitar...";
  modelViewer.style.display = "none";

  // Animasi scan 3 detik
  setTimeout(() => {
    scannerText.innerText = "✅ Scan selesai!";
    modelViewer.style.display = "block";
  }, 3000);
});
