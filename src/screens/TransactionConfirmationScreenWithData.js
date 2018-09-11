import { get } from 'lodash';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { AlertIOS, StatusBar, Vibration } from 'react-native';
import lang from 'i18n-js';
import { connect } from 'react-redux';
import { sendTransaction } from '../model/wallet';
import { accountUpdateHasPendingTransaction, accountUpdateTransactions } from 'balance-common';
import { walletConnectSendTransactionHash } from '../model/walletconnect';
import TransactionConfirmationScreen from './TransactionConfirmationScreen';
import { removeTransaction } from '../reducers/transactionsToApprove';

class TransactionConfirmationScreenWithData extends Component {
  static propTypes = {
    accountUpdateHasPendingTransaction: PropTypes.func,
    accountUpdateTransactions: PropTypes.func,
    navigation: PropTypes.any,
    removeTransaction: PropTypes.func,
  }

  state = {
    transactionDetails: null,
  }

  componentDidMount() {
    StatusBar.setBarStyle('light-content', true);
    Vibration.vibrate();
  }

  handleConfirmTransaction = async () => {
    try {
      const { transactionDetails } = this.state;
      const transactionReceipt = await sendTransaction(transactionDetails.transactionPayload, lang.t('wallet.transaction.confirm'));
      if (transactionReceipt && transactionReceipt.hash) {
        const txDetails = {
          amount: get(transactionDetails, 'transactionDisplayDetails.value'),
          asset: get(transactionDetails, 'transactionDisplayDetails.symbol'),
          from: get(transactionDetails, 'transactionDisplayDetails.from'),
          gasLimit: get(transactionDetails, 'transactionDisplayDetails.gasLimit'),
          gasPrice: get(transactionDetails, 'transactionDisplayDetails.gasPrice'),
          hash = transactionReceipt.hash;
          nonce: get(transactionDetails, 'transactionDisplayDetails.nonce'),
          to: get(transactionDetails, 'transactionDisplayDetails.to'),
        };
        this.props.accountUpdateHasPendingTransaction();
        this.props.accountUpdateTransactions(txDetails);
        this.props.removeTransaction(transactionDetails.transactionId);
        try {
          const walletConnector = this.props.walletConnectors[transactionDetails.sessionId];
          await walletConnectSendTransactionHash(walletConnector, transactionDetails.transactionId, true, transactionReceipt.hash);
          // TODO: update that this transaction has been confirmed and reset txn details
          this.closeTransactionScreen();
        } catch (error) {
          // TODO error handling when txn hash failed to send; store somewhere?
          this.closeTransactionScreen();
          AlertIOS.alert(lang.t('wallet.transaction.alert.transaction_status'));
        }
      } else {
        try {
          this.handleCancelTransaction();
        } catch (error) {
          this.closeTransactionScreen();
          AlertIOS.alert(lang.t('wallet.transaction.alert.failed_transaction_status'));
        }
      }
    } catch (error) {
      // TODO only send failed status after multiple tries
      this.sendFailedTransactionStatus();
      AlertIOS.alert(lang.t('wallet.transaction.alert.authentication'));
    }
  };

  sendFailedTransactionStatus = async () => {
    try {
      const { transactionDetails } = this.state;
      this.props.removeTransaction(transactionDetails.transactionId);
      const walletConnector = this.props.walletConnectors[transactionDetails.sessionId];
      await walletConnectSendTransactionHash(walletConnector, transactionDetails.transactionId, false, null);
      this.closeTransactionScreen();
    } catch (error) {
      this.closeTransactionScreen();
      AlertIOS.alert(lang.t('wallet.transaction.alert.cancelled_transaction'));
    }
  }

  handleCancelTransaction = async () => {
    this.props.removeTransaction(transactionDetails.transactionId);
    await sendFailedTransactionStatus();
  }

  closeTransactionScreen = () => {
    StatusBar.setBarStyle('dark-content', true);
    this.props.navigation.goBack();
  }

  render = () => {
    const { transactionDetails } = this.state;

    return (
      <TransactionConfirmationScreen
        asset={{
          address: get(transactionDetails, 'transactionDisplayDetails.to'),
          amount: `${get(transactionDetails, 'transactionDisplayDetails.value', '0.00')}`,
          dappName: `${get(transactionDetails, 'dappName', '')}`,
          name: `${get(transactionDetails, 'transactionDisplayDetails.name', 'No data')}`,
          nativeAmount: get(transactionDetails, 'transactionDisplayDetails.nativeAmount'),
          symbol: `${get(transactionDetails, 'transactionDisplayDetails.symbol', 'N/A')}`,
        }}
        onCancelTransaction={this.handleCancelTransaction}
        onConfirmTransaction={this.handleConfirmTransaction}
      />
    );
  }
}

export default connect(
  ({
    transactionsToApprove: { transactionsToApprove },
    walletconnect: { walletConnectors }
  }) => ({ transactionsToApprove, walletConnectors }),
  {
    accountUpdateHasPendingTransaction,
    accountUpdateTransactions,
    removeTransaction
  },
)(TransactionConfirmationScreenWithData);
