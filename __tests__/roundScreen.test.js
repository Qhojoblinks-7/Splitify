/**
 * @jest-environment node
 *
 * The round screen must be loadable.
 *
 * This is not a rendering test and does not pretend to be one. There is no
 * `@testing-library/react-native` in this project, and adding a renderer to check that a file's
 * imports resolve is not a trade worth making. What it *is* for is the failure that actually
 * happened while this screen was being written: it imported `prop-types`, which is not a
 * dependency of this app, so the module threw the moment anything required it. Nothing else in
 * the suite would have caught that — the projection tests exercise `roundView.js`, not the
 * component, and the backend suite never sees the frontend.
 *
 * So the native and router modules are mocked, the screen is required, and the assertions are
 * about its module graph and its own logic: that it loads, that it asks the server for a round
 * rather than building one, and that it refuses a group id it cannot use.
 */
// Native modules with nothing to talk to in node. Mocks rather than real modules because
// `react-native` itself pulls in a native runtime this environment does not have.
jest.mock("react-native", () => {
  const ReactLocal = require("react");
  const passthrough = (name) => (props) => ReactLocal.createElement(name, props, props.children);
  const StyleSheet = { create: (styles) => styles, flatten: (style) => style };
  return {
    View: passthrough("View"),
    Text: passthrough("Text"),
    ScrollView: passthrough("ScrollView"),
    ActivityIndicator: passthrough("ActivityIndicator"),
    RefreshControl: passthrough("RefreshControl"),
    StyleSheet,
  };
});

jest.mock("expo-router", () => ({ useLocalSearchParams: jest.fn(() => ({ id: "7" })) }));

jest.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
}));

// Capture what the screen asked the data layer for, so the assertions can inspect the request
// rather than a rendered result.
const mockUseQuery = jest.fn(() => ({ data: undefined, error: null, isPending: true }));
const mockUseMutation = jest.fn((options) => ({ ...options, isPending: false }));
const mockQueryClient = { invalidateQueries: jest.fn(), clear: jest.fn() };
jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args) => mockUseQuery(...args),
  useMutation: (...args) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

describe("the round screen module", () => {
  let RoundScreen;

beforeEach(() => {
    mockUseQuery.mockClear();
    mockUseMutation.mockClear();
    // `mockClear` drops calls but keeps return values, so the "loaded" state a test set up would
    // otherwise leak into the next one and render a round that was never fetched.
    mockUseQuery.mockReturnValue({ data: undefined, error: null, isPending: true });
    jest.resetModules();
    RoundScreen = require("../app/susu/round").default;
  });

  it("loads, which is the whole point of this file", () => {
    expect(typeof RoundScreen).toBe("function");
  });

  it("asks the server for the round rather than building one", () => {
    RoundScreen();

    expect(mockUseQuery).toHaveBeenCalledTimes(1);

    const [options] = mockUseQuery.mock.calls[0];
    expect(options.queryKey).toEqual(["round", "current", 7]);
    expect(typeof options.queryFn).toBe("function");
  });

  it("never sends a request for a group id it cannot use", () => {
    // `enabled: false` is what stops the query firing, so it is the thing to assert. A request
    // built from `undefined` would ask the server about a group that does not exist.
    const router = require("expo-router");
    router.useLocalSearchParams.mockReturnValue({ id: "not-a-number" });
    mockUseQuery.mockReturnValue({ data: undefined, error: null, isPending: false });

    RoundScreen();

    expect(mockUseQuery.mock.calls[0][0].enabled).toBe(false);
  });

  it("logs a payment and can withdraw one, both against the server", () => {
    RoundScreen();

    // Two writes: log and withdraw. Neither is a local edit — a logged payment is an attempt,
    // and the pot only moves when the server says the money is verified (C-S1).
    expect(mockUseMutation).toHaveBeenCalledTimes(2);
    for (const [options] of mockUseMutation.mock.calls) {
      expect(typeof options.mutationFn).toBe("function");
    }
  });
});