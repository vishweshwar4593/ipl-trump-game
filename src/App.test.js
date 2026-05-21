import { render, screen } from '@testing-library/react';
import App from './App';

test('renders round information', () => {
  render(<App />);
  const element = screen.getByText(/round/i);
  expect(element).toBeInTheDocument();
});