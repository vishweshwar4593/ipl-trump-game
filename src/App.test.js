import { render, screen } from '@testing-library/react';
import App from './App';

// Mock Auth Context
jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
    isEmailLink: jest.fn(() => false),
    completeEmailLinkSignIn: jest.fn(),
  }),
}));

// Mock Firebase RTDB
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(),
  ref: jest.fn(),
  get: jest.fn(() => Promise.resolve({ exists: () => false })),
  set: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
}));

// Mock Socket.io
jest.mock('./socket', () => ({
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
}));

test('renders login screen or home screen containing IPL title', () => {
  render(<App />);
  const element = screen.getByText(/IPL/i);
  expect(element).toBeDefined();
});