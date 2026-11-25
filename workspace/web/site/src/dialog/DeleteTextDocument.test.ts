import { shallowMount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { TextDoc } from "@vue-offline-first/db-config";
import DeleteTextDocument from "./DeleteTextDocument.vue";

const removeMock = vi.fn();

vi.mock("../plugins/jobDb.js", () => ({
  useJobDb: () => ({
    remove: removeMock,
  }),
}));

vi.mock("../components/Button.vue", () => ({
  default: defineComponent({
    name: "Button",
    props: ["size", "variant", "disabled"],
    emits: ["click"],
    setup(props, { slots, emit }) {
      return () =>
        h(
          "button",
          {
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
    props: ["modelValue", "title"],
    emits: ["update:modelValue"],
    setup(props, { slots }) {
      return () =>
        h(
          "div",
          {
            "data-testid": "dialog",
            "data-open": String(props.modelValue),
            "data-title": props.title,
          },
          [
            h("div", { "data-testid": "dialog-body" }, slots.default?.()),
            h("div", { "data-testid": "dialog-footer" }, slots.footer?.()),
          ],
        );
    },
  }),
}));

describe("DeleteTextDocumentDialog", () => {
  const sampleRecord = {
    _id: "doc-123",
    title: "Meeting Notes",
    content: "Some text",
  } as TextDoc;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountComponent(record: TextDoc = sampleRecord) {
    return shallowMount(DeleteTextDocument, {
      props: { record },
      global: {
        stubs: {
          Button: false,
          Dialog: false,
        },
      },
    });
  }

  it("renders closed by default and displays the record title in the confirmation prompt", () => {
    const wrapper = mountComponent();
    const dialog = wrapper.find("[data-testid='dialog']");

    expect(dialog.attributes("data-open")).toBe("false");
    expect(dialog.attributes("data-title")).toBe("Delete Document");
    expect(wrapper.find("[data-testid='dialog-body']").text()).toContain(
      'Are you sure you want to delete "Meeting Notes"?',
    );
  });

  it("opens dialog when trigger Delete button is clicked and closes when Close button is clicked", async () => {
    const wrapper = mountComponent();
    const dialog = wrapper.find("[data-testid='dialog']");

    // Trigger button is outside the dialog
    const triggerBtn = wrapper.find("button");
    await triggerBtn.trigger("click");
    expect(dialog.attributes("data-open")).toBe("true");

    const closeBtn = wrapper
      .find("[data-testid='dialog-footer']")
      .findAll("button")
      .find((b) => b.text() === "Close")!;

    await closeBtn.trigger("click");
    expect(dialog.attributes("data-open")).toBe("false");
  });

  it("calls remove(record._id), emits 'deleted', and closes dialog when confirmed", async () => {
    removeMock.mockResolvedValue(undefined);
    const wrapper = mountComponent();

    await wrapper.find("button").trigger("click");

    const confirmBtn = wrapper
      .find("[data-testid='dialog-footer']")
      .findAll("button")
      .find((b) => b.text() === "Delete")!;

    await confirmBtn.trigger("click");
    await flushPromises();

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith("doc-123");
    expect(wrapper.emitted("deleted")).toHaveLength(1);
    expect(wrapper.find("[data-testid='dialog']").attributes("data-open")).toBe(
      "false",
    );
  });

  it("does not call remove or emit 'deleted' if record._id is missing, but still closes dialog", async () => {
    const recordWithoutId = {
      title: "Unsaved Doc",
      content: "",
    } as TextDoc;

    const wrapper = mountComponent(recordWithoutId);
    await wrapper.find("button").trigger("click");

    const confirmBtn = wrapper
      .find("[data-testid='dialog-footer']")
      .findAll("button")
      .find((b) => b.text() === "Delete")!;

    await confirmBtn.trigger("click");
    await flushPromises();

    expect(removeMock).not.toHaveBeenCalled();
    expect(wrapper.emitted("deleted")).toBeUndefined();
    expect(wrapper.find("[data-testid='dialog']").attributes("data-open")).toBe(
      "false",
    );
  });
});
