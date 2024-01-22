import './Popup.scss';

import React, { useEffect, useState } from 'react';
import { runtime } from 'webextension-polyfill';

import PopupFooter from '@/components/Popup/PopupFooter';
import PopupHeader from '@/components/Popup/PopupHeader';
import { sendMessage, sendMessageToActiveTab } from '@/utils/sendMessages';

const Success = runtime.getURL('assets/images/web-monetization-success.svg');
const Fail = runtime.getURL('assets/images/web-monetization-fail.svg');
const CheckIcon = runtime.getURL('assets/images/check.svg');
const DollarIcon = runtime.getURL('assets/images/dollar.svg');
const CloseIcon = runtime.getURL('assets/images/close.svg');

const Popup = () => {
  const [loading, setLoading] = useState(false);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [spent, setSpent] = useState(0);
  const [sendingPaymentPointer, setSendingPaymentPointer] = useState('');
  const [isMonetizationReady, setIsMonetizationReady] = useState(false);
  const [receivingPaymentPointer, setReceivingPaymentPointer] = useState('');
  const [formData, setFormData] = useState({
    paymentPointer: sendingPaymentPointer || '',
    amount: 20,
  });

  useEffect(() => {
    checkMonetizationReady();
    getSendingPaymentPointer();
    listenForIncomingPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkMonetizationReady = async () => {
    const response = await sendMessageToActiveTab({ type: 'IS_MONETIZATION_READY' });
    setIsMonetizationReady(response.data.monetization);
    setReceivingPaymentPointer(response.data.paymentPointer);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    const data = {
      amount: formData.amount,
      paymentPointer: formData.paymentPointer,
      incomingPayment: receivingPaymentPointer,
    };

    await sendMessage({ type: 'SET_INCOMING_POINTER', data });
  };

  const getSendingPaymentPointer = async () => {
    const response = await sendMessage({ type: 'GET_SENDING_PAYMENT_POINTER' });
    setSendingPaymentPointer(response.data.sendingPaymentPointerUrl);

    const { sendingPaymentPointerUrl: paymentPointer, amount } = response.data;
    if (paymentPointer && amount) {
      setFormData({
        paymentPointer: response.data.sendingPaymentPointerUrl,
        amount: response.data.amount,
      });
    }
  };

  const listenForIncomingPayment = async () => {
    const listener = (message: any) => {
      if (message.type === 'SPENT_AMOUNT') {
        setSpent(message.data.spentAmount);
        setPaymentStarted(true);
      }

      if (loading) {
        setLoading(false);
      }
    };

    runtime.onMessage.addListener(listener);
    return () => {
      runtime.onMessage.removeListener(listener);
    };
  };

  const stopPayments = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    setPaymentStarted(false);
    setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 1000);
    await sendMessageToActiveTab({ type: 'STOP_PAYMENTS' });
  };

  return (
    <div className="wrapper w-popup h-popup border-base">
      <PopupHeader />
      {!!spent && (
        <div className="spentAmount">
          ${spent}/<span>$20</span>
        </div>
      )}
      <div className="content">
        {isMonetizationReady ? (
          <>
            <img src={Success} alt="Success" />

            <form
              onSubmit={handleSubmit}
              className={`pointerForm ${paymentStarted ? 'active' : ''}`}
            >
              <div className="input-wrapper">
                <label htmlFor="paymentPointer">Payment pointer</label>
                <div className="input">
                  <input
                    type="text"
                    name="paymentPointer"
                    value={formData.paymentPointer}
                    onInput={handleChange}
                    disabled={paymentStarted}
                    placeholder="https://ilp.rafiki.money/alice"
                  />
                </div>
              </div>

              <div className="input-wrapper">
                <label htmlFor="pointer">Amount</label>
                <div className="input">
                  <img src={DollarIcon} alt="dollar" />
                  <input
                    type="text"
                    name="amount"
                    value={formData.amount}
                    onInput={handleChange}
                    disabled={paymentStarted}
                    placeholder="0.05"
                  />
                </div>
              </div>

              <div className="actions">
                {paymentStarted ? (
                  <button type="button" className="stop-btn" onClick={stopPayments}>
                    <img src={CloseIcon} alt="Stop" />
                  </button>
                ) : (
                  <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`}>
                    <img src={CheckIcon} alt="Check" />
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <img src={Fail} alt="Fail" />
        )}
      </div>
      <PopupFooter isMonetizationReady={isMonetizationReady} />
    </div>
  );
};

export default Popup;
