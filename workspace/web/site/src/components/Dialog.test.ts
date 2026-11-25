import { shallowMount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import Dialog from "./Dialog.vue";

vi.mock("./ButtonBar.vue", () => ({
  default: defineComponent({
    name: "ButtonBar",
    template: "<button-bar-stub><slot /></button-bar-stub>",
  }),
}));

describe("Dialog", () => {
  let showModalSpy: ReturnType<typeof vi.fn<() => void>>;
  let closeSpy: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    showModalSpy = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    closeSpy = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });

    HTMLDialogElement.prototype.showModal = showModalSpy;
    HTMLDialogElement.prototype.close = closeSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Modal Visibility & `modelValue` Sync", () => {
    it("does not call showModal() when closed by default", async () => {
      shallowMount(Dialog);
      await nextTick();

      expect(showModalSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it("calls showModal() on mount when modelValue is true", async () => {
      shallowMount(Dialog, {
        props: { modelValue: true },
      });
      await nextTick();

      expect(showModalSpy).toHaveBeenCalledTimes(1);
    });

    it("calls showModal() and close() when modelValue toggles", async () => {
      const wrapper = shallowMount(Dialog, {
        props: { modelValue: false },
      });

      await wrapper.setProps({ modelValue: true });
      expect(showModalSpy).toHaveBeenCalledTimes(1);

      await wrapper.setProps({ modelValue: false });
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it("emits update:modelValue=false when native dialog `close` event fires", async () => {
      const wrapper = shallowMount(Dialog, {
        props: { modelValue: true },
      });

      await wrapper.find("dialog").trigger("close");

      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("closes when clicking the <dialog> backdrop directly", async () => {
      const wrapper = shallowMount(Dialog, {
        props: { modelValue: true },
      });

      await wrapper.find("dialog").trigger("click");

      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("does not close when clicking inside .dialog-inner", async () => {
      const wrapper = shallowMount(Dialog, {
        props: { modelValue: true },
      });

      await wrapper.find(".dialog-inner").trigger("click");

      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });
  });

  describe("Header & Close Button", () => {
    it("hides .dialog-header when neither title prop nor header slot is provided", () => {
      const wrapper = shallowMount(Dialog);

      expect(wrapper.find(".dialog-header").exists()).toBe(false);
    });

    it("renders title prop and closes dialog when clicking close button", async () => {
      const wrapper = shallowMount(Dialog, {
        props: {
          title: "Confirm Action",
          modelValue: true,
        },
      });

      expect(wrapper.find(".dialog-title").text()).toBe("Confirm Action");

      await wrapper.find(".dialog-close").trigger("click");
      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("renders custom header slot over title prop", () => {
      const wrapper = shallowMount(Dialog, {
        props: { title: "Ignored Title" },
        slots: {
          header: "<span class='custom-header'>Custom Header</span>",
        },
      });

      expect(wrapper.find(".dialog-title").exists()).toBe(false);
      expect(wrapper.find(".custom-header").text()).toBe("Custom Header");
    });
  });

  describe("Alert Slot", () => {
    it("hides .dialog-alert when alert slot is empty", () => {
      const wrapper = shallowMount(Dialog);

      expect(wrapper.find(".dialog-alert").exists()).toBe(false);
    });

    it.each([
      { variant: "warning" as const, expectedRole: "alert" },
      { variant: "error" as const, expectedRole: "alert" },
      { variant: "info" as const, expectedRole: "status" },
    ])(
      "renders alert slot with class dialog-alert--$variant and role=$expectedRole",
      ({ variant, expectedRole }) => {
        const wrapper = shallowMount(Dialog, {
          props: { alertVariant: variant },
          slots: {
            alert: "Alert message",
          },
        });

        const alert = wrapper.find(".dialog-alert");
        expect(alert.exists()).toBe(true);
        expect(alert.classes()).toContain(`dialog-alert--${variant}`);
        expect(alert.attributes("role")).toBe(expectedRole);
        expect(alert.text()).toBe("Alert message");
      },
    );
  });

  describe("Body & Footer Slots", () => {
    it("renders default slot content inside .dialog-body", () => {
      const wrapper = shallowMount(Dialog, {
        slots: {
          default: "Body content",
        },
      });

      expect(wrapper.find(".dialog-body").text()).toBe("Body content");
    });

    it("hides .dialog-footer when footer slot is empty", () => {
      const wrapper = shallowMount(Dialog);

      expect(wrapper.find(".dialog-footer").exists()).toBe(false);
    });

    it("renders footer slot wrapped inside mocked ButtonBar", () => {
      const wrapper = shallowMount(Dialog, {
        global: {
          stubs: {
            ButtonBar: false,
          },
        },
        slots: {
          footer: "<button>Save</button>",
        },
      });

      const footer = wrapper.find(".dialog-footer");
      expect(footer.exists()).toBe(true);

      const buttonBar = footer.findComponent({ name: "ButtonBar" });
      expect(buttonBar.exists()).toBe(true);
      expect(buttonBar.text()).toBe("Save");
    });
  });
});
