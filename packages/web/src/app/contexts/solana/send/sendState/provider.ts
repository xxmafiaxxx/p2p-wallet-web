import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { TokenAccount } from '@p2p-wallet-web/core';
import { tryParseTokenAmount, useTokenAccount, useWallet } from '@p2p-wallet-web/core';
import { usePubkey } from '@p2p-wallet-web/sail';
import { TokenAmount } from '@p2p-wallet-web/token-utils';
import type { RenNetwork } from '@renproject/interfaces';
import { PublicKey } from '@solana/web3.js';
import { createContainer } from 'unstated-next';

import { isValidBitcoinAddress, isValidSolanaAddress } from 'app/contexts';
import type { DestinationAccount } from 'app/contexts/solana/send/sendState/types';
import { useRenNetwork } from 'utils/hooks/renBridge/useNetwork';

import { useResolveAddress } from './hooks/useResolveAddress';
import { isValidAddress } from './utils';

export enum Blockchain {
  solana = 'solana',
  bitcoin = 'bitcoin',
}

export const BLOCKCHAINS = [Blockchain.solana, Blockchain.bitcoin] as const;

export interface UseSendState {
  fromTokenAccount?: TokenAccount | null;
  setFromTokenAccount: (v: TokenAccount) => void;

  fromAmount: string;
  setFromAmount: (v: string) => void;
  parsedAmount: TokenAmount | undefined;

  toPublicKey: string;
  setToPublicKey: (v: string) => void;
  destinationAddress: string;

  resolvedAddress: string | null;
  setResolvedAddress: (v: string | null) => void;

  blockchain: Blockchain;
  setBlockchain: (v: Blockchain) => void;

  isAutomatchNetwork: boolean;
  setIsAutomatchNetwork: (v: boolean) => void;

  isAddressNotMatchNetwork: boolean;

  renNetwork: RenNetwork;

  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;

  isAddressInvalid: boolean;

  isRenBTC: boolean;
  isRawSOL: boolean;

  isShowConfirmAddressSwitch: boolean;
  setIsShowConfirmAddressSwitch: (v: boolean) => void;

  isInitBurnAndRelease: boolean;
  setIsInitBurnAndRelease: (v: boolean) => void;

  destinationAccount: DestinationAccount | null;
  isResolvingAddress: boolean;

  hasBalance: boolean;

  details: {
    receiveAmount?: string;
    totalAmount?: string;
    totalAmountToShow?: string;
  };
}

const useSendStateInternal = (): UseSendState => {
  const { publicKey } = useParams<{ publicKey: string }>();
  const { publicKey: publicKeySol } = useWallet();
  const { resolveAddress } = useResolveAddress();

  const tokenAccount = useTokenAccount(usePubkey(publicKey ?? publicKeySol));
  const [fromTokenAccount, setFromTokenAccount] = useState<TokenAccount | null | undefined>(null);

  const [fromAmount, setFromAmount] = useState('');
  const parsedAmount = tryParseTokenAmount(
    fromTokenAccount?.balance?.token ?? undefined,
    fromAmount,
  );

  const [toPublicKey, setToPublicKey] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  const [blockchain, setBlockchain] = useState<Blockchain>(BLOCKCHAINS[0]);
  const [isAutomatchNetwork, setIsAutomatchNetwork] = useState(true);

  const renNetwork = useRenNetwork();

  const [isExecuting, setIsExecuting] = useState(false);

  const [isShowConfirmAddressSwitch, setIsShowConfirmAddressSwitch] = useState(false);
  const [isInitBurnAndRelease, setIsInitBurnAndRelease] = useState(false);

  const [destinationAccount, setDestinationAccount] = useState<DestinationAccount | null>(null);

  const destinationAddress = resolvedAddress || toPublicKey;

  const isRenBTC = fromTokenAccount?.balance?.token.symbol === 'renBTC';
  const isRawSOL = !!fromTokenAccount?.balance?.token.isRawSOL;

  const isAddressInvalid = useMemo(() => {
    if (destinationAddress.length) {
      return !isValidAddress(destinationAddress, renNetwork);
    }

    return false;
  }, [destinationAddress, renNetwork]);

  useEffect(() => {
    if (isRenBTC) {
      setIsAutomatchNetwork(true);
      setBlockchain(Blockchain.solana);
    }
  }, [isRenBTC]);

  useEffect(() => {
    if (!isRenBTC) {
      return;
    }

    if (isAutomatchNetwork) {
      if (isValidSolanaAddress(destinationAddress)) {
        setBlockchain(Blockchain.solana);
        setIsAutomatchNetwork(false);
      } else if (isValidBitcoinAddress(destinationAddress, renNetwork)) {
        setBlockchain(Blockchain.bitcoin);
        setIsAutomatchNetwork(false);
      }
    }
  }, [isRenBTC, isAutomatchNetwork, destinationAddress, renNetwork]);

  const isAddressNotMatchNetwork = useMemo(() => {
    if (!isRenBTC) {
      return false;
    }

    if (!isAutomatchNetwork) {
      if (!isAddressInvalid) {
        if (
          (isValidBitcoinAddress(destinationAddress, renNetwork) &&
            blockchain !== Blockchain.bitcoin) ||
          (isValidSolanaAddress(destinationAddress) && blockchain !== Blockchain.solana)
        ) {
          return true;
        }
      }
    }

    return false;
  }, [isRenBTC, isAutomatchNetwork, isAddressInvalid, destinationAddress, blockchain, renNetwork]);

  useEffect(() => {
    if (tokenAccount?.balance) {
      setFromTokenAccount(tokenAccount);
    }

    const tokenSymbol = tokenAccount?.balance?.token?.symbol;
    const shouldUseSolanaNetwork =
      tokenSymbol && tokenSymbol !== 'renBTC' && blockchain === 'bitcoin';

    if (shouldUseSolanaNetwork) {
      setBlockchain(BLOCKCHAINS[0]);
    }
  }, [tokenAccount]);

  useEffect(() => {
    const resolve = async () => {
      if (
        destinationAddress &&
        fromTokenAccount &&
        fromTokenAccount.balance &&
        blockchain === 'solana'
      ) {
        const isSOL = fromTokenAccount.balance.token.isRawSOL;

        if (isValidSolanaAddress(destinationAddress)) {
          if (!isSOL) {
            setIsResolvingAddress(true);

            const { owner, needCreateATA } = await resolveAddress(
              new PublicKey(destinationAddress),
              fromTokenAccount.balance.token,
            );

            setIsResolvingAddress(true);
            setDestinationAccount({
              address: new PublicKey(destinationAddress),
              owner,
              isNeedCreate: needCreateATA,
              symbol: fromTokenAccount.balance.token.symbol,
            });
          } else {
            setDestinationAccount({
              address: new PublicKey(destinationAddress),
            });
          }
        }
      } else {
        setDestinationAccount(null);
      }
    };

    if (!isAddressInvalid) {
      void resolve();
    }
  }, [destinationAddress, fromTokenAccount, isAddressInvalid, resolveAddress]);

  const hasBalance = useMemo(() => {
    if (!tokenAccount?.balance) {
      return false;
    }

    const tokenAccountBalance = tokenAccount.balance;

    return tokenAccountBalance ? tokenAccountBalance.asNumber >= Number(fromAmount) : false;
  }, [fromAmount, tokenAccount]);

  const details = useMemo(() => {
    let receiveAmount;

    if (!parsedAmount && fromTokenAccount && fromTokenAccount.balance) {
      receiveAmount = new TokenAmount(fromTokenAccount.balance.token, 0).formatUnits();
    } else if (parsedAmount) {
      receiveAmount = parsedAmount.formatUnits();
    }

    const totalAmount = receiveAmount;
    const totalAmountToShow = receiveAmount;

    return {
      receiveAmount,
      totalAmount,
      totalAmountToShow,
    };
  }, [fromTokenAccount, parsedAmount]);

  return {
    fromTokenAccount,
    setFromTokenAccount,
    fromAmount,
    setFromAmount,
    parsedAmount,
    toPublicKey,
    setToPublicKey,
    destinationAddress,
    resolvedAddress,
    setResolvedAddress,
    blockchain,
    setBlockchain,
    isAutomatchNetwork,
    setIsAutomatchNetwork,
    isAddressNotMatchNetwork,
    renNetwork,
    isExecuting,
    setIsExecuting,
    isAddressInvalid,
    isRenBTC,
    isRawSOL,
    isShowConfirmAddressSwitch,
    setIsShowConfirmAddressSwitch,
    isInitBurnAndRelease,
    setIsInitBurnAndRelease,
    destinationAccount,
    isResolvingAddress,
    hasBalance,
    details,
  };
};

export const { Provider: SendStateProvider, useContainer: useSendState } =
  createContainer(useSendStateInternal);
