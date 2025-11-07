import { useEffect, useRef } from "react";

export function useWalletEvents({
  walletProvider,
  onAccountsChanged,
  onChainChanged,
}) {
  const accountsRef = useRef(onAccountsChanged);
  const chainRef = useRef(onChainChanged);

  useEffect(() => {
    accountsRef.current = onAccountsChanged;
  }, [onAccountsChanged]);

  useEffect(() => {
    chainRef.current = onChainChanged;
  }, [onChainChanged]);

  useEffect(() => {
    const eth =
      walletProvider ||
      (typeof window !== "undefined" ? window.ethereum : null);

    if (!eth || !eth.on) return;

    const handleAccounts = (...args) => accountsRef.current?.(...args);
    const handleChain = (...args) => chainRef.current?.(...args);

    eth.on("accountsChanged", handleAccounts);
    eth.on("chainChanged", handleChain);

    return () => {
      eth.removeListener?.("accountsChanged", handleAccounts);
      eth.removeListener?.("chainChanged", handleChain);
    };
  }, [walletProvider]);
}
