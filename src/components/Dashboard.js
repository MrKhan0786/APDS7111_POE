import React, { useState, useEffect } from 'react';

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedSection, setSelectedSection] = useState('profile');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Fetch users and payments data from backend
    const fetchData = async () => {
      try {
        const usersResponse = await fetch('/api/users');
        const usersData = await usersResponse.json();
        setUsers(usersData);

        const paymentsResponse = await fetch('/api/payments');
        const paymentsData = await paymentsResponse.json();
        setPayments(paymentsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const renderContent = () => {
    switch (selectedSection) {
      case 'profile':
        return (
          <div style={styles.container}>
            <h2>User Profile Summary</h2>
            <div style={styles.infoContainer}>
              <p><strong>Username:</strong> johndoe</p>
              <p><strong>Contact Details:</strong> johndoe@example.com</p>
              <p><strong>Last Login:</strong> April 23, 2025</p>
            </div>
          </div>
        );
      case 'recipients':
        return (
          <div style={styles.container}>
            <h2>Saved Recipients</h2>
            <div style={styles.infoContainer}>
              <ul>
                <li>Mary - mary@example.com</li>
                <li>Ahmed - ahmed@bank.com</li>
                <li>Chloe - chloe@finance.org</li>
              </ul>
            </div>
          </div>
        );
      case 'history':
        return (
          <div style={styles.container}>
            <h2>Payment History</h2>
            <div style={styles.infoContainer}>
              {payments.length === 0 ? (
                <p>No payment history available.</p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} style={styles.paymentItem}>
                    <p><strong>Username:</strong> {payment.username}</p>
                    <p><strong>Full Name:</strong> {payment.full_name}</p>
                    <p><strong>Amount:</strong> ${payment.amount}</p>
                    <p><strong>Status:</strong> {payment.payment_status}</p>
                    <p><strong>Card Number:</strong> {payment.card_number}</p>
                    <hr />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div style={styles.container}>
            <h2>Account Settings</h2>
            <div style={styles.infoContainer}>
              <button style={styles.btn}>Change Password</button>
            </div>
          </div>
        );
      default:
        return <p>Select a dashboard item to continue.</p>;
    }
  };

  return (
    <div style={styles.pageWrapper}>
      <aside style={{ ...styles.sidebar, width: isSidebarOpen ? 200 : 60 }}>
        <h3 style={styles.sidebarHeader} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? 'User Dashboard' : '📊'}
        </h3>
        <nav style={styles.menu}>
          <div
            onClick={() => setSelectedSection('profile')}
            style={{ ...styles.menuItem, ...(selectedSection === 'profile' ? styles.menuItemActive : {}) }}
          >
            Profile
          </div>
          <div
            onClick={() => setSelectedSection('recipients')}
            style={{ ...styles.menuItem, ...(selectedSection === 'recipients' ? styles.menuItemActive : {}) }}
          >
            Recipients
          </div>
          <div
            onClick={() => setSelectedSection('history')}
            style={{ ...styles.menuItem, ...(selectedSection === 'history' ? styles.menuItemActive : {}) }}
          >
            Payment History
          </div>
          <div
            onClick={() => setSelectedSection('settings')}
            style={{ ...styles.menuItem, ...(selectedSection === 'settings' ? styles.menuItemActive : {}) }}
          >
            Settings
          </div>
        </nav>
      </aside>

      <main style={styles.mainContent}>
        <h2 style={styles.contentTitle}>User Dashboard</h2>
        {renderContent()}
      </main>
    </div>
  );
}

const styles = {
  pageWrapper: {
    display: 'flex',
    backgroundColor: '#e0e0e0',
    height: 'calc(100vh - 140px)', // Adjust for navbar height (140px)
    overflow: 'hidden',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  sidebar: {
    backgroundColor: '#2c3e50',
    color: '#ecf0f1',
    paddingTop: 20,
    paddingLeft: 10,
    paddingRight: 10,
    height: '100%',
    boxSizing: 'border-box',
    transition: 'width 0.3s ease-in-out',
    userSelect: 'none',
  },
  sidebarHeader: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '1.2rem',
    marginBottom: 20,
    cursor: 'pointer',
    color: '#bdc3c7',
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  menuItem: {
    padding: '10px 8px',
    fontSize: '1rem',
    backgroundColor: '#34495e',
    borderRadius: 6,
    textAlign: 'center',
    cursor: 'pointer',
    color: '#ecf0f1',
    transition: 'background-color 0.2s ease',
  },
  menuItemActive: {
    backgroundColor: '#1abc9c',
    color: '#fff',
    fontWeight: '600',
  },
  mainContent: {
    backgroundColor: '#f7f9fc',
    flexGrow: 1,
    padding: '30px',
    height: '100%',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  contentTitle: {
    fontSize: '2rem',
    marginBottom: 20,
    color: '#34495e',
  },
  container: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 10,
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    marginBottom: 20,
  },
  infoContainer: {
    marginTop: 15,
    fontSize: '1.1rem',
    color: '#555',
  },
  paymentItem: {
    marginBottom: 15,
  },
  btn: {
    padding: '10px 18px',
    fontSize: '1rem',
    backgroundColor: '#1abc9c',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
};

export default Dashboard;
