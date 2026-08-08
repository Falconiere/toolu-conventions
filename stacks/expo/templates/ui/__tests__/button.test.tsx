// Reference test for the Button primitive — the co-located, real-behavior pattern
// every test in this repo follows.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/ui/button';

// Render a primitive, query by role/text, assert real behavior (not tautologies
// like `expect(x).toBeDefined()`). The SDK 53-compatible testing library uses a
// synchronous render and event API.

describe('Button', () => {
  it('renders its label', () => {
    render(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress while loading', () => {
    const onPress = jest.fn();
    render(<Button label="Save" loading onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
