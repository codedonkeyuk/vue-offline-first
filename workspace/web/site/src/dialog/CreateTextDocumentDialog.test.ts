import { shallowMount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import CreateTextDocumentDialog from "./CreateTextDocumentDialog.vue";

const saveTextDocMock = vi.fn();

vi.mock("../plugins/jobDb.js", () => ({
  useJobDb: () => ({
    saveTextDoc: saveTextDocMock,
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

vi.mock("../components/Input.vue", () => ({
  default: defineComponent({
    name: "Input",
    props: ["id", "label", "type", "modelValue", "required"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("input", {
          id: props.id,
          type: props.type,
          value: props.modelValue,
          onInput: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLInputElement).value),
        });
    },
  }),
}));

describe("CreateTextDocumentDIalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountComponent() {
    return shallowMount(CreateTextDocumentDialog, {
      global: {
        stubs: {
          Button: false,
          Dialog: false,
          Input: false,
        },
      },
    });
  }

  function findButtonByText(
    wrapper: ReturnType<typeof mountComponent>,
    text: string,
  ) {
    return wrapper.findAll("button").find((b) => b.text() === text)!;
  }

  it("renders closed by default with trigger button and disabled Create button", () => {
    const wrapper = mountComponent();

    expect(wrapper.find("[data-testid='dialog']").attributes("data-open")).toBe(
      "false",
    );
    expect(findButtonByText(wrapper, "Create Text Documnent").exists()).toBe(
      true,
    );
    expect(
      findButtonByText(wrapper, "Create & open").attributes("disabled"),
    ).toBeDefined();
  });

  it("opens dialog when trigger button is clicked and closes when Close button is clicked", async () => {
    const wrapper = mountComponent();
    const dialog = wrapper.find("[data-testid='dialog']");

    await findButtonByText(wrapper, "Create Text Documnent").trigger("click");
    expect(dialog.attributes("data-open")).toBe("true");

    await findButtonByText(wrapper, "Close").trigger("click");
    expect(dialog.attributes("data-open")).toBe("false");
  });

  it("resets inputVar when dialog is reopened", async () => {
    const wrapper = mountComponent();
    const input = wrapper.find("#document-name");

    await findButtonByText(wrapper, "Create Text Documnent").trigger("click");
    await input.setValue("Draft Notes");
    expect((input.element as HTMLInputElement).value).toBe("Draft Notes");

    await findButtonByText(wrapper, "Close").trigger("click");
    await findButtonByText(wrapper, "Create Text Documnent").trigger("click");

    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("enables Create button when input has text, calls saveTextDoc, emits 'created', and closes dialog", async () => {
    saveTextDocMock.mockResolvedValue(undefined);
    const wrapper = mountComponent();

    await findButtonByText(wrapper, "Create Text Documnent").trigger("click");
    await wrapper.find("#document-name").setValue("Project Plan");

    const createBtn = findButtonByText(wrapper, "Create & open");
    expect(createBtn.attributes("disabled")).toBeUndefined();

    await createBtn.trigger("click");
    await flushPromises();

    expect(saveTextDocMock).toHaveBeenCalledTimes(1);
    expect(saveTextDocMock).toHaveBeenCalledWith({
      title: "Project Plan",
      content: "New Document",
    });
    expect(wrapper.emitted("created")).toHaveLength(1);
    expect(wrapper.find("[data-testid='dialog']").attributes("data-open")).toBe(
      "false",
    );
  });
});
