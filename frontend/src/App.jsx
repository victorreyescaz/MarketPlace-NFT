import MarketplaceGallery from "./components/MarketPlaceGallery";
import MintNFTForm from "./components/MintNFTForm";

function App() {
  return (
  <>
    <header className="p-4 bg-gray-100 flex justify-between">
      <h1 className="text-xl font-bold text-blue-600">MarketPlace NFT</h1>
      <appkit-button />
    </header>

    <main className="p-4">
      <MintNFTForm/>
      <hr className="my-6" />
      <MarketplaceGallery/>
    </main>
  </>
  );
}

export default App;
