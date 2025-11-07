import PropTypes from "prop-types";
import { Button, VStack, HStack, Text } from "@chakra-ui/react";

function WalletControls ({
    isConnected,
    address,
    proceedsEth,
    loadingNFTs,
    loadingGlobal,
    globalCursor,

    open,
    loadMyNFTs,
    refreshProceeds,
    withdrawProceeds,
    loadAllListings,

    setQ, setMinP, setMaxP, setSort
}) {

{/* Si no hay wallet conectada mostramos boton de conexion, si hay wallet mostramos direcion publica y botones*/}
    if (!isConnected) {
      <Button 
      onClick={() => open({ view: "Connect", namespace: "eip155" })} colorScheme="teal">
        Conectar Wallet
      </Button>
    };

    return(
      <VStack>
        <Text>
            Conectado como: {address?.slice(0, 6)}...{address?.slice(-4)}
        </Text>

        <HStack>
          <Button 
          onClick={loadMyNFTs} 
          isLoading={loadingNFTs} 
          colorScheme="purple">
            Mis NFTs
          </Button>

          <Button 
          onClick={refreshProceeds} variant="outline"> {/* El variant="outline" hace que el color del boton sea dark*/}
            Actualizar saldo
          </Button>

          <Button 
          onClick={withdrawProceeds} 
          isDisabled={Number(proceedsEth) <= 0}>
            Retirar {proceedsEth} ETH
          </Button>
          
          <Button
            colorScheme="orange"
            isDisabled={loadingGlobal}
            onClick={() => {
              // reset de filtros/orden
              setQ("");
              setMinP("");
              setMaxP("");
              setSort("recent");
              // primera carga
              loadAllListings(true);
            }}
          >
            Marketplace Global
        </Button>

        {!globalCursor.done && (
          <Button 
          onClick={() => loadAllListings(false)} 
          isLoading={loadingGlobal} 
          isDisabled={loadingGlobal} variant="outline">
            Cargar más
          </Button>
        )}
        </HStack>
      </VStack>
    );
}

WalletControls.propTypes = {
    isConnected: PropTypes.bool.isRequired,
    address: PropTypes.string,
    proceedsEth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    loadingNFTs: PropTypes.bool,
    loadingGlobal: PropTypes.bool,
    globalCursor:PropTypes.shape({
        done: PropTypes.bool.isRequired,
    }).isRequired,

    open:PropTypes.func.isRequired,
    loadMyNFTs: PropTypes.func.isRequired,
    refreshProceeds: PropTypes.func.isRequired,
    withdrawProceeds: PropTypes.func.isRequired,
    loadAllListings: PropTypes.func.isRequired,

    setQ: PropTypes.func.isRequired,
    setMinP: PropTypes.func.isRequired,
    setMaxP: PropTypes.func.isRequired,
    setSort: PropTypes.func.isRequired,
    };

WalletControls.defaultProps = {
  address: "",
  loadingNFTs: false,
  loadingGlobal: false,
};

export default WalletControls;