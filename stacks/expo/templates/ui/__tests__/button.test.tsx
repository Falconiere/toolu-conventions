// Reference test for the Button primitive — the co-located, real-behavior pattern
// every test in this repo follows.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/ui/button';

// react-native-testing-library v14 has an async API: await render / fireEvent.
// Render a primitive, query by role/text, assert real behavior (not tautologies
// like `expect(x).toBeDefined()`).

describe('Button', () => {
  it('renders its label', async () => {
    await render(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('fires onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" loading onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
