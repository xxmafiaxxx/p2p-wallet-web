import type { FC } from 'react';
import { useMemo } from 'react';

import { styled } from '@linaria/react';
import { useTokenAccount } from '@p2p-wallet-web/core';
import { usePubkey } from '@p2p-wallet-web/sail';
import { PublicKey } from '@solana/web3.js';

import {
  ModalType,
  useFeeCalculation,
  useModals,
  useSendState,
  useTransferAction,
} from 'app/contexts';
import type { TransactionConfirmModalProps } from 'components/modals/TransactionConfirmModal/TransactionConfirmModal';
import type { TransactionStatusModalProps } from 'components/modals/TransactionInfoModals/TransactionStatusSendModal/TransactionStatusSendModal';
import { Button, Icon } from 'components/ui';
import { trackEvent } from 'utils/analytics';

const SendIcon = styled(Icon)`
  width: 24px;
  height: 24px;
  margin-right: 12px;
`;

interface Props {
  primary: boolean;
  disabled: boolean;
}

export const SendButtonSolana: FC<Props> = ({ primary, disabled }) => {
  const { openModal } = useModals();
  const sendState = useSendState();
  const transferAction = useTransferAction();
  const destinationTokenAccount = useTokenAccount(usePubkey(sendState.destinationAddress));
  const {
    fromAmount,
    fromTokenAccount,
    resolvedAddress,
    toPublicKey,
    destinationAddress,
    setIsExecuting,
    parsedAmount,
    destinationAccount,
    hasBalance,
    details,
    isAddressNotMatchNetwork,
  } = sendState;
  const { isInsufficientFundsForFee } = useFeeCalculation();

  const handleSubmit = async () => {
    if (!fromTokenAccount?.key || !fromTokenAccount?.balance || !parsedAmount) {
      throw new Error("Didn't find token account");
    }

    if (parsedAmount.equalTo(0)) {
      throw new Error('Invalid amount');
    }

    if (!destinationAccount) {
      throw new Error('Invalid destination');
    }

    const destination = new PublicKey(destinationAddress);

    if (parsedAmount.token.symbol !== 'SOL') {
      if (
        destinationTokenAccount &&
        destinationTokenAccount.balance && // FIXME
        destinationTokenAccount.balance?.token.symbol !== 'SOL' &&
        !destinationTokenAccount.balance?.token.mintAccount.equals(parsedAmount.token.mintAccount)
      ) {
        void openModal(ModalType.SHOW_MODAL_ERROR, {
          icon: 'wallet',
          header: 'Wallet address is not valid',
          text: `The wallet address is not valid. It must be a ${parsedAmount.token.symbol} wallet address`,
        });
        return;
      }
    }

    const result = await openModal<boolean, TransactionConfirmModalProps>(
      ModalType.SHOW_MODAL_TRANSACTION_CONFIRM,
      {
        type: 'send',
        params: {
          source: fromTokenAccount,
          destination,
          amount: parsedAmount,
          username: resolvedAddress ? toPublicKey : '',
        },
        sendState: { fromTokenAccount, destinationAccount, details },
      } as TransactionConfirmModalProps,
    );

    if (!result) {
      return false;
    }

    try {
      setIsExecuting(true);

      const action = transferAction({
        fromTokenAccount,
        destinationAccount,
        amount: parsedAmount,
      });

      trackEvent('send_send_click', {
        tokenTicker: fromTokenAccount.balance.token.symbol || '',
        sum: parsedAmount.asNumber,
      });

      await openModal<void, TransactionStatusModalProps>(
        ModalType.SHOW_MODAL_TRANSACTION_STATUS_SEND,
        {
          type: 'send',
          action,
          params: {
            source: fromTokenAccount,
            destination: new PublicKey(destinationAddress),
            amount: parsedAmount,
            username: resolvedAddress ? toPublicKey : '',
          },
          sendState,
        },
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const text = useMemo(() => {
    if (!Number(fromAmount)) {
      return 'Enter the amount';
    }

    if (!hasBalance) {
      return <>There is not enough {fromTokenAccount?.balance?.token.symbol} balance</>;
    }

    if (!destinationAddress) {
      return 'Choose the recipient';
    }

    if (isAddressNotMatchNetwork) {
      return 'Change the network or the address';
    }

    if (isInsufficientFundsForFee) {
      return 'Insufficient funds to cover fees';
    }

    return (
      <>
        <SendIcon name="top" />
        Send {details.totalAmountToShow}
      </>
    );
  }, [
    destinationAddress,
    fromAmount,
    fromTokenAccount?.balance,
    hasBalance,
    details.totalAmountToShow,
    isAddressNotMatchNetwork,
    isInsufficientFundsForFee,
  ]);

  return (
    <Button primary={primary} disabled={disabled} big full onClick={handleSubmit}>
      {text}
    </Button>
  );
};
