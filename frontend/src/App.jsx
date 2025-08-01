import MarketplaceGallery from "./components/MarketPlaceGallery";

function App() {
  return (
  <>
    <header className="p-4 bg-gray-100 flex justify-between">
      <h1 className="text-xl font-bold text-blue-600">MarketPlace NFT</h1>
      <appkit-button />
    </header>

    <main>
      <MarketplaceGallery/>
    </main>
  </>
  );
}

export default App;
