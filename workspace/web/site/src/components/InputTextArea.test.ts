import { shallowMount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import InputTextArea from "./InputTextArea.vue";

vi.mock("./FormField.vue", () => ({
  default: defineComponent({
    name: "FormField",
    props: ["id", "label", "required", "error", "helpText", "errorMessage"],
    setup(props, { slots }) {
      return () =>
        h("form-field-stub", null, [
          slots.default?.({
            id: props.id,
            required: props.required,
            "aria-invalid": true,
            "aria-describedby": "mock-desc",
          }),
        ]);
    },
  }),
}));

describe("InputTextArea", () => {
  const defaultProps = {
    id: "description",
    label: "Description",
    modelValue: "",
  };

  function mountTextArea(
    props: Record<string, unknown> = {},
    attrs: Record<string, unknown> = {},
  ) {
    return shallowMount(InputTextArea, {
      props: {
        ...defaultProps,
        ...props,
      },
      attrs,
      global: {
        stubs: {
          FormField: false,
        },
      },
    });
  }

  it("forwards field props to mocked FormField", () => {
    const wrapper = mountTextArea({
      id: "notes",
      label: "Notes",
      required: true,
      error: true,
      helpText: "Add extra context",
      errorMessage: "Notes cannot be empty",
    });

    const formField = wrapper.findComponent({ name: "FormField" });
    expect(formField.exists()).toBe(true);
    expect(formField.props()).toEqual({
      id: "notes",
      label: "Notes",
      required: true,
      error: true,
      helpText: "Add extra context",
      errorMessage: "Notes cannot be empty",
    });
  });

  it("renders a <textarea> with default rows='4' and class 'field-input'", () => {
    const wrapper = mountTextArea();
    const textarea = wrapper.find("textarea");

    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes("rows")).toBe("4");
    expect(textarea.classes()).toContain("field-input");
  });

  it("binds custom rows prop to <textarea>", () => {
    const wrapper = mountTextArea({ rows: 8 });
    const textarea = wrapper.find("textarea");

    expect(textarea.attributes("rows")).toBe("8");
  });

  it("binds slotProps from FormField onto the inner <textarea>", () => {
    const wrapper = mountTextArea({ id: "user-bio", required: true });
    const textarea = wrapper.find("textarea");

    expect(textarea.attributes("id")).toBe("user-bio");
    expect(textarea.attributes("required")).toBeDefined();
    expect(textarea.attributes("aria-invalid")).toBe("true");
    expect(textarea.attributes("aria-describedby")).toBe("mock-desc");
  });

  it("forwards extra $attrs to the inner <textarea> and not the root element (inheritAttrs: false)", () => {
    const wrapper = mountTextArea(
      {},
      {
        placeholder: "Write something...",
        maxlength: "500",
        spellcheck: "false",
      },
    );

    expect(wrapper.attributes("placeholder")).toBeUndefined();

    const textarea = wrapper.find("textarea");
    expect(textarea.attributes("placeholder")).toBe("Write something...");
    expect(textarea.attributes("maxlength")).toBe("500");
    expect(textarea.attributes("spellcheck")).toBe("false");
  });

  it("syncs v-model value in both directions", async () => {
    const wrapper = mountTextArea({ modelValue: "initial text" });
    const textarea = wrapper.find("textarea");

    expect(textarea.element.value).toBe("initial text");

    await textarea.setValue("updated text");
    expect(wrapper.emitted("update:modelValue")).toEqual([["updated text"]]);

    await wrapper.setProps({ modelValue: "from-parent" });
    expect(textarea.element.value).toBe("from-parent");
  });
});
