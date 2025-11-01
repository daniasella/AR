document.getElementById("btnCamera").addEventListener("click", async () => {
  const arSection = document.getElementById("ar-section");
  arSection.classList.remove("hidden");

  // Kamera live
  const videoContainer = document.getElementById("camera-container");
  videoContainer.innerHTML = '';
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  videoContainer.appendChild(video);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
  } catch(err) {
    alert("Gagal akses kamera: " + err);
    return;
  }

  // Setup Three.js
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    videoContainer.clientWidth / videoContainer.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 2;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(videoContainer.clientWidth, videoContainer.clientHeight);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = 0;
  renderer.domElement.style.left = 0;
  videoContainer.appendChild(renderer.domElement);

  // Lampu
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(1, 1, 1);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // Load OBJ
  const loader = new THREE.OBJLoader();
  loader.load('assets/models/wifi-icon_1.glb', (obj) => {
    obj.scale.set(0.5, 0.5, 0.5);
    obj.position.set(0, 0, 0);
    scene.add(obj);

    // Animasi rotate + float
    function animate() {
      requestAnimationFrame(animate);
      obj.rotation.y += 0.01;
      obj.position.y = 0.2 * Math.sin(Date.now() * 0.002);
      renderer.render(scene, camera);
    }
    animate();
  }, 
  (xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
  },
  (error) => {
    console.error('Gagal load OBJ:', error);
  });

  // Resize responsive
  window.addEventListener("resize", () => {
    camera.aspect = videoContainer.clientWidth / videoContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(videoContainer.clientWidth, videoContainer.clientHeight);
  });
});