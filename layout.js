import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { CompanyProvider } from '../context/CompanyContext';

export const metadata = {
  title: 'SmartERP — Billing, Inventory & Accounting',
  description: 'A Tally-inspired billing, inventory, accounting and GST management system.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CompanyProvider>{children}</CompanyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
