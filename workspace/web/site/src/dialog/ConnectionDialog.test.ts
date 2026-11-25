import { shallowMount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import ConnectionDialog from "./ConnectionDialog.vue";

const connectSyncMock = vi.fn();
const logoutMock = vi.fn();
const isSyncEnabledMock = ref(false);
const syncStateMock = ref<string>("idle");

vi.mock("../plugins/jobDb.js", () => ({
  useJobDb: () => ({
    connectSync: connectSyncMock,
    logout: logoutMock,
    isSyncEnabled: isSyncEnabledMock,
    syncState: syncStateMock,
  }),
}));

vi.mock("../components/Button.vue", () => ({
  default: defineComponent({
    name: "Button",
    props: ["type", "size", "variant", "disabled"],
    emits: ["click"],
    setup(props, { slots, emit }) {
      return () =>
        h(
          "button",
          {
            type: props.type,
            disabled: props.disabled,
            "data-variant": props.variant,
            "data-size": props.size,
            onClick: (e: MouseEvent) => emit("click", e),
          },
          slots.default?.(),
        );
    },
  }),
}));

vi.mock("../components/Dialog.vue", () => ({
  default: defineComponent({
    name: "Dialog",
    props: ["modelValue", "title", "alertVariant"],
    emits: ["update:modelValue"],
    setup(props, { slots }) {
      return () =>
        h(
          "div",
          { "data-testid": "dialog", "data-open": String(props.modelValue) },
          [
            slots.alert
              ? h("div", { "data-testid": "dialog-alert" }, slots.alert())
              : null,
            h("div", { "data-testid": "dialog-body" }, slots.default?.()),
            h("div", { "data-testid": "dialog-footer" }, slots.footer?.()),
          ],
        );
    },
  }),
}));

vi.mock("../components/Input.vue", () => ({
  default: defineComponent({
    name: "Input",
    props: ["id", "label", "modelValue", "type", "required", "error"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("input", {
          id: props.id,
          type: props.type ?? "text",
          value: props.modelValue,
          "data-error": String(props.error),
          onInput: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLInputElement).value),
        });
    },
  }),
}));

describe("ConnectionDialog", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    isSyncEnabledMock.value = false;
    syncStateMock.value = "idle";
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_AUTH_API_URL", "https://example.com");
    vi.stubEnv("VITE_COUCH_BASE_URL", "https://example.com");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mountComponent() {
    return shallowMount(ConnectionDialog, {
      global: {
        stubs: {
          Button: false,
          Dialog: false,
          Input: false,
        },
      },
    });
  }

  describe("Connection Status Display", () => {
    it("shows 'Not Connected' when isSyncEnabled is false", () => {
      const wrapper = mountComponent();

      expect(wrapper.find("button").text()).toContain(
        "Connection: Not Connected",
      );
      expect(wrapper.find("[data-testid='dialog-body']").text()).toContain(
        "Connection Status: Not Connected",
      );
    });

    it("shows 'Denied' / 'Connection Denied' when syncState is 'denied'", () => {
      isSyncEnabledMock.value = true;
      syncStateMock.value = "denied";
      const wrapper = mountComponent();

      expect(wrapper.find("button").text()).toContain("Connection: Denied");
      expect(wrapper.find("[data-testid='dialog-body']").text()).toContain(
        "Connection Status: Connection Denied",
      );
    });

    it("shows 'Error' / 'Connection Error' when syncState is 'error'", () => {
      isSyncEnabledMock.value = true;
      syncStateMock.value = "error";
      const wrapper = mountComponent();

      expect(wrapper.find("button").text()).toContain("Connection: Error");
      expect(wrapper.find("[data-testid='dialog-body']").text()).toContain(
        "Connection Status: Connection Error",
      );
    });

    it("shows 'Connected' when isSyncEnabled is true and syncState is active", () => {
      isSyncEnabledMock.value = true;
      syncStateMock.value = "active";
      const wrapper = mountComponent();

      expect(wrapper.find("button").text()).toContain("Connection: Connected");
      expect(wrapper.find("[data-testid='dialog-body']").text()).toContain(
        "Connection Status: Connected",
      );
    });
  });

  describe("Dialog Open & Close", () => {
    it("opens dialog when trigger button is clicked and closes when Close button is clicked", async () => {
      const wrapper = mountComponent();
      const dialog = wrapper.find("[data-testid='dialog']");

      expect(dialog.attributes("data-open")).toBe("false");

      await wrapper.find("button").trigger("click");
      expect(dialog.attributes("data-open")).toBe("true");

      const closeBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "Close")!;
      await closeBtn.trigger("click");
      expect(dialog.attributes("data-open")).toBe("false");
    });
  });

  describe("Login Submission (`handleSubmit`)", () => {
    it("submits credentials, calls connectSync, and clears inputs on success", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ dbName: "user_db", token: "jwt-123" }),
      });
      connectSyncMock.mockResolvedValue(undefined);

      const wrapper = mountComponent();
      await wrapper.find("#username").setValue("alice");
      await wrapper.find("#password").setValue("secret");

      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "secret" }),
      });

      expect(connectSyncMock).toHaveBeenCalledWith({
        remoteBaseUrl: "https://example.com",
        remoteDbName: "user_db",
        token: "jwt-123",
      });

      expect(wrapper.find("[data-testid='dialog-alert']").exists()).toBe(false);
      expect(
        (wrapper.find("#username").element as HTMLInputElement).value,
      ).toBe("");
      expect(
        (wrapper.find("#password").element as HTMLInputElement).value,
      ).toBe("");
    });

    it("displays server error message and marks inputs with error on failed HTTP response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid credentials" }),
      });

      const wrapper = mountComponent();
      await wrapper.find("#username").setValue("alice");
      await wrapper.find("#password").setValue("wrong");

      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(connectSyncMock).not.toHaveBeenCalled();
      expect(wrapper.find("[data-testid='dialog-alert']").text()).toBe(
        "Invalid credentials",
      );
      expect(wrapper.find("#username").attributes("data-error")).toBe("true");
      expect(wrapper.find("#password").attributes("data-error")).toBe("true");
      expect(
        (wrapper.find("#username").element as HTMLInputElement).value,
      ).toBe("");
      expect(
        (wrapper.find("#password").element as HTMLInputElement).value,
      ).toBe("");
    });

    it("falls back to 'Login failed' when error response has no error field", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      const wrapper = mountComponent();
      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(wrapper.find("[data-testid='dialog-alert']").text()).toBe(
        "Login failed",
      );
    });

    it("displays error when connectSync rejects", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ dbName: "user_db", token: "jwt-123" }),
      });
      connectSyncMock.mockRejectedValue(new Error("Sync unreachable"));

      const wrapper = mountComponent();
      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(wrapper.find("[data-testid='dialog-alert']").text()).toBe(
        "Sync unreachable",
      );
    });
  });

  describe("Logout (`handleLogout`)", () => {
    it("hides login inputs when connected and calls logout when Logout button is clicked", async () => {
      isSyncEnabledMock.value = true;
      logoutMock.mockResolvedValue(undefined);

      const wrapper = mountComponent();
      expect(wrapper.find("#username").exists()).toBe(false);
      expect(wrapper.find("#password").exists()).toBe(false);

      const logoutBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "Logout")!;
      expect(logoutBtn.attributes("disabled")).toBeUndefined();

      await logoutBtn.trigger("click");
      await flushPromises();

      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(wrapper.find("[data-testid='dialog-alert']").exists()).toBe(false);
    });

    it("displays error message when logout fails", async () => {
      isSyncEnabledMock.value = true;
      logoutMock.mockRejectedValue(new Error("Logout failed"));

      const wrapper = mountComponent();
      const logoutBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "Logout")!;

      await logoutBtn.trigger("click");
      await flushPromises();

      expect(wrapper.find("[data-testid='dialog-alert']").text()).toBe(
        "Logout failed",
      );
    });
  });
});
