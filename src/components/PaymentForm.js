import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import backgroundImage from '../image/building.jpg'; // Ensure this file exists

function PaymentForm() {
  const { user } = useAuth();
  const [username, setUsername] = useState(user ? user.username : '');
  const [fullName, setFullName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    const formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formattedValue);
  };

  const handleExpiryChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      setExpiry(value.slice(0, 2) + '/' + value.slice(2, 4));
    } else {
      setExpiry(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !fullName || !cardNumber || !expiry || !cvv || !amount) {
      setPaymentStatus('Please fill in all fields.');
      return;
    }

    try {
      const paymentResponse = await axios.post('http://localhost:5000/api/payment', {
        username,
        fullName,
        cardNumber,
        expiry,
        cvv,
        amount,
      });

      if (paymentResponse.data.success) {
        setPaymentStatus('Payment was successful!');
      } else {
        setPaymentStatus('Payment failed. Please try again.');
      }
    } catch (error) {
      setPaymentStatus('Error processing payment. Please try again.');
    }
  };

  return (
    <div style={styles.wrapper}> {/* Background image applied here */}
      <div style={styles.overlay} />
      <div style={styles.container}>
        <h2 style={styles.heading}>Make a Payment</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formField}>
            <label style={styles.label}>Username:</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={styles.input} />
          </div>
          <div style={styles.formField}>
            <label style={styles.label}>Full Name:</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required style={styles.input} />
          </div>
          <div style={styles.formField}>
            <label style={styles.label}>Card Number:</label>
            <input type="text" value={cardNumber} onChange={handleCardNumberChange} required maxLength="19" placeholder="XXXX XXXX XXXX XXXX" style={styles.input} />
          </div>
          <div style={styles.row}>
            <div style={styles.formField}>
              <label style={styles.label}>Expiry Date (MM/YY):</label>
              <input type="text" value={expiry} onChange={handleExpiryChange} required maxLength="5" placeholder="MM/YY" style={styles.halfInput} />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>CVV:</label>
              <input type="password" value={cvv} onChange={e => setCvv(e.target.value)} required maxLength="3" style={styles.halfInput} />
            </div>
          </div>
          <div style={styles.formField}>
            <label style={styles.label}>Amount:</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required style={styles.input} />
          </div>
          <button type="submit" style={styles.button}>Pay Now</button>
        </form>

        {paymentStatus && (
          <div style={styles.statusMessageBox}>
            <p style={styles.statusMessage}>{paymentStatus}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
      backgroundImage: 'url(https://source.unsplash.com/featured/?nature)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      height: '100vh',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '50px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Poppins', sans-serif",
    },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Semi-transparent white background for form
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
    width: '400px',
    position: 'relative',
    zIndex: 1,
  },
  heading: {
    textAlign: 'center',
    marginBottom: '25px',
    fontSize: '1.5rem',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formField: {
    marginBottom: '15px',
  },
  label: {
    fontSize: '1rem',
    marginBottom: '5px',
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '8px',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '5px',
    boxSizing: 'border-box',
  },
  halfInput: {
    width: '48%',
    padding: '8px',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '5px',
    boxSizing: 'border-box',
  },
  button: {
    padding: '10px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  statusMessageBox: {
    marginTop: '20px',
    textAlign: 'center',
  },
  statusMessage: {
    color: '#333',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
};

export default PaymentForm;
