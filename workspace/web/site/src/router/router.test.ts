const {
  createRouterMock,
  createWebHistoryMock,
  mockHistoryInstance,
  mockRouterInstance,
  MockTextDocumentView,
  MockTextDocumentEditorView,
} = vi.hoisted(() => {
  const mockHistoryInstance = { type: "mock-web-history" };
  const mockRouterInstance = { install: vi.fn() };

  return {
    mockHistoryInstance,
    mockRouterInstance,
    createRouterMock: vi.fn(
      (_options: { history: unknown; routes: any[] }) => mockRouterInstance,
    ),
    createWebHistoryMock: vi.fn(() => mockHistoryInstance),
    MockTextDocumentView: { name: "TextDocumentView" },
    MockTextDocumentEditorView: { name: "TextDocumentEditorView" },
  };
});

vi.mock("vue-router", () => ({
  createRouter: createRouterMock,
  createWebHistory: createWebHistoryMock,
}));

vi.mock("../views/TextDocumentView.vue", () => ({
  default: MockTextDocumentView,
}));

vi.mock("../views/TextDocumentEditorView.vue", () => ({
  default: MockTextDocumentEditorView,
}));

import router from "./router.js";

describe("router", () => {
  it("creates web history using import.meta.env.BASE_URL", () => {
    expect(createWebHistoryMock).toHaveBeenCalledTimes(1);
    expect(createWebHistoryMock).toHaveBeenCalledWith(import.meta.env.BASE_URL);
  });

  it("exports the router instance returned by createRouter", () => {
    expect(createRouterMock).toHaveBeenCalledTimes(1);
    expect(router).toBe(mockRouterInstance);
  });

  it("configures the '/' (main) route with eager TextDocumentView component", () => {
    const config = createRouterMock.mock.calls[0]![0];
    expect(config.history).toBe(mockHistoryInstance);

    const mainRoute = config.routes.find((r) => r.name === "main");
    expect(mainRoute).toEqual({
      path: "/",
      name: "main",
      component: MockTextDocumentView,
    });
  });

  it("configures the '/document/:id' (document) route with props: true and lazy-loaded TextDocumentEditorView", async () => {
    const config = createRouterMock.mock.calls[0]![0];

    const docRoute = config.routes.find((r) => r.name === "document");
    expect(docRoute).toBeDefined();
    expect(docRoute.path).toBe("/document/:id");
    expect(docRoute.name).toBe("document");
    expect(docRoute.props).toBe(true);
    expect(typeof docRoute.component).toBe("function");

    const lazyLoadedModule = await docRoute.component();
    expect(lazyLoadedModule.default).toBe(MockTextDocumentEditorView);
  });
});
