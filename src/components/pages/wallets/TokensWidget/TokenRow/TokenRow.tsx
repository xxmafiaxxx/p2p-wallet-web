import React, { FunctionComponent } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { styled } from '@linaria/react';
import classNames from 'classnames';
import { rgba } from 'polished';

import { TokenAccount } from 'api/token/TokenAccount';
import { AmountUSD } from 'components/common/AmountUSD';
import { TokenAvatar } from 'components/common/TokenAvatar';
import { Menu } from 'components/ui';
import { MenuItem } from 'components/ui/Menu/MenuItem';
import { updateHiddenTokens } from 'store/slices/wallet/WalletSlice';
import {
  hideUnhideToken,
  hideUnhideZeroBalanceToken,
  removeHiddenToken,
  removeZeroBalanceToken,
} from 'utils/settings';
import { shortAddress } from 'utils/tokens';

const Content = styled.div`
  position: relative;

  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  margin-left: 20px;
`;

const Top = styled.div`
  display: flex;
  justify-content: space-between;

  color: #000;
  font-weight: 600;
  font-size: 18px;
  line-height: 27px;
`;

const TokenName = styled.div`
  max-width: 300px;
  overflow: hidden;

  white-space: nowrap;
  text-overflow: ellipsis;
`;

const TokenAvatarStyled = styled(TokenAvatar)``;

const WrapperLink = styled(Link)`
  display: flex;
  align-items: center;
  padding: 10px;

  text-decoration: none;

  cursor: pointer;
`;

const Bottom = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 5px;

  color: #a3a5ba;
  font-weight: 600;
  font-size: 14px;
  line-height: 140%;
`;

const MenuWrapper = styled.div`
  position: absolute;

  top: 30%;
  right: -45px;

  padding-left: 15px;

  opacity: 0;
`;

const Wrapper = styled.div`
  position: relative;

  padding: 10px 0;

  &.isHidden {
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  }

  &:hover {
    ${MenuWrapper} {
      opacity: 1;
    }

    ${WrapperLink} {
      background: #f6f6f8;
      border-radius: 12px;
    }

    ${TokenAvatarStyled} {
      background: #fff;
    }

    ${TokenName} {
      color: #5887ff;
    }
  }

  &:not(:last-child) {
    &::after {
      position: absolute;
      right: 10px;
      bottom: 0;
      left: 10px;

      border-bottom: 1px solid ${rgba(0, 0, 0, 0.05)};

      content: '';
    }
  }
`;

type Props = {
  token: TokenAccount;
  isHidden?: boolean;
  isZeroBalancesHidden?: boolean;
};

export const TokenRow: FunctionComponent<Props> = ({
  token,
  isHidden = false,
  isZeroBalancesHidden = true,
}) => {
  const dispatch = useDispatch();
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const handleMenuItemClick = () => {
    const tokenAddress = token.address.toBase58();
    if (isZeroBalancesHidden && token.balance.lte(0)) {
      hideUnhideZeroBalanceToken(tokenAddress);
      removeHiddenToken(tokenAddress);
    } else {
      hideUnhideToken(tokenAddress);
      removeZeroBalanceToken(tokenAddress);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    dispatch(updateHiddenTokens());
  };

  const isNotSOL = token.mint.symbol !== 'SOL';

  return (
    <Wrapper className={classNames({ isHidden })}>
      <WrapperLink to={`/wallet/${token.address.toBase58()}`}>
        <TokenAvatarStyled symbol={token.mint.symbol} size={48} />
        <Content>
          <Top>
            <TokenName title={token.mint.address.toBase58()}>
              {token.mint.symbol || shortAddress(token.mint.address.toBase58())}
            </TokenName>
            <AmountUSD
              value={token.mint.toMajorDenomination(token.balance)}
              symbol={token.mint.symbol}
            />
          </Top>
          <Bottom>
            <div title={token.address.toBase58()}>{shortAddress(token.address.toBase58())}</div>
            <div>
              {token.mint.toMajorDenomination(token.balance).toString()} {token.mint.symbol}
            </div>
          </Bottom>
        </Content>
      </WrapperLink>
      {isNotSOL ? (
        <MenuWrapper>
          <Menu vertical>
            <MenuItem onItemClick={handleMenuItemClick} icon={isHidden ? 'eye' : 'hide'}>
              {isHidden ? 'Show' : 'Hide'}
            </MenuItem>
          </Menu>
        </MenuWrapper>
      ) : undefined}
    </Wrapper>
  );
};