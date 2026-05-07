import { useState, useEffect, useCallback } from 'react'

const BASE_SEPOLIA_CHAIN_ID = '0x14a34'  // 84532
const BASE_SEPOLIA_PARAMS = {
  chainId:          BASE_SEPOLIA_CHAIN_ID,
  chainName:        'Base Sepolia',
  nativeCurrency:   { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls:          ['https://sepolia.base.org'],
  blockExplorerUrls:['https://sepolia.basescan.org'],
}
const PAYMENT_WEI = '0x38D7EA4C68000'   // 0.001 ETH

export function useWallet() {
  const [account,   setAccount]   = useState(null)   // '0x...'
  const [chainId,   setChainId]   = useState(null)   // '0x...'
  const [status,    setStatus]    = useState('idle')  // idle | connecting | ready | wrong_chain | sending | confirming | error
  const [error,     setError]     = useState('')

  const provider = typeof window !== 'undefined' ? window.ethereum : null
  const isCorrectChain = chainId?.toLowerCase() === BASE_SEPOLIA_CHAIN_ID

  // Sync account/chain from injected provider on mount
  useEffect(() => {
    if (!provider) return
    provider.request({ method: 'eth_accounts' }).then((accs) => {
      if (accs?.length) setAccount(accs[0])
    })
    provider.request({ method: 'eth_chainId' }).then(setChainId)

    const onAccountsChanged = (accs) => setAccount(accs[0] || null)
    const onChainChanged    = (id)   => setChainId(id)
    provider.on('accountsChanged', onAccountsChanged)
    provider.on('chainChanged',    onChainChanged)
    return () => {
      provider.removeListener('accountsChanged', onAccountsChanged)
      provider.removeListener('chainChanged',    onChainChanged)
    }
  }, [provider])

  useEffect(() => {
    if (!account)          setStatus('idle')
    else if (!isCorrectChain) setStatus('wrong_chain')
    else                   setStatus('ready')
  }, [account, isCorrectChain])

  const connect = useCallback(async () => {
    if (!provider) { setError('No wallet detected. Install MetaMask or Coinbase Wallet.'); return }
    setStatus('connecting'); setError('')
    try {
      const accs = await provider.request({ method: 'eth_requestAccounts' })
      setAccount(accs[0])
      const id = await provider.request({ method: 'eth_chainId' })
      setChainId(id)
    } catch (e) {
      setError(e.message || 'Connection rejected')
      setStatus('idle')
    }
  }, [provider])

  const switchChain = useCallback(async () => {
    if (!provider) return
    setError('')
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }] })
    } catch (e) {
      if (e.code === 4902) {
        try {
          await provider.request({ method: 'wallet_addEthereumChain', params: [BASE_SEPOLIA_PARAMS] })
        } catch (e2) {
          setError('Could not add Base Sepolia network')
        }
      } else {
        setError(e.message || 'Network switch rejected')
      }
    }
  }, [provider])

  // Send 0.001 ETH to toAddress, return tx hash
  const pay = useCallback(async (toAddress) => {
    if (!provider || !account) throw new Error('Wallet not connected')
    setStatus('sending'); setError('')
    try {
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  account,
          to:    toAddress,
          value: PAYMENT_WEI,
        }],
      })
      setStatus('confirming')
      // Poll for receipt (up to 60s)
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] })
        if (receipt) {
          if (receipt.status === '0x1') {
            setStatus('ready')
            return txHash
          }
          throw new Error('Transaction reverted on-chain')
        }
      }
      throw new Error('Transaction not confirmed after 60s')
    } catch (e) {
      setStatus('ready')
      throw e
    }
  }, [provider, account])

  return { account, chainId, isCorrectChain, status, error, provider, connect, switchChain, pay }
}
