// test-appkit.cjs
const { createAppKit } = require("@reown/appkit");
const { EthersAdapter } = require("@reown/appkit-adapter-ethers");
const { sepolia } = require("@reown/appkit/networks");

const projectId = "572cd4e95b82ee7e2cdd5190c46e3db0";

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  projectId,
  metadata: {
    name: "Prueba AppKit Node",
    description: "Test manual de initialize AppKit",
    url: "http://localhost:5173",
  },
});

console.log("🧾 AppKit inicial:", appKit);

setTimeout(async () => {
  try {
    const ready =
      typeof appKit.isReady === "function" ? await appKit.isReady : false;
    console.log("✅ isReady:", ready);

    if (ready && typeof appKit.getContract === "function") {
      console.log("📦 getContract disponible ✅");
    } else {
      console.warn("⚠️ getContract no disponible");
    }
  } catch (err) {
    console.error("❌ Error en AppKit:", err);
  }
}, 2000);
