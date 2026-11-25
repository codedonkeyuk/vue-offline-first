import { shallowMount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import Input from "./Input.vue";

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

describe("Input", () => {
  const defaultProps = {
    id: "email",
    label: "Email Address",
    modelValue: "",
  };

  function mountInput(
    props: Record<string, unknown> = {},
    attrs: Record<string, unknown> = {},
  ) {
    return shallowMount(Input, {
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
    const wrapper = mountInput({
      id: "username",
      label: "Username",
      required: true,
      error: true,
      helpText: "Pick a unique handle",
      errorMessage: "Already taken",
    });

    const formField = wrapper.findComponent({ name: "FormField" });
    expect(formField.exists()).toBe(true);
    expect(formField.props()).toEqual({
      id: "username",
      label: "Username",
      required: true,
      error: true,
      helpText: "Pick a unique handle",
      errorMessage: "Already taken",
    });
  });

  it("renders an <input> with default type='text' and class 'field-input'", () => {
    const wrapper = mountInput();
    const input = wrapper.find("input");

    expect(input.exists()).toBe(true);
    expect(input.attributes("type")).toBe("text");
    expect(input.classes()).toContain("field-input");
  });

  it("binds custom type prop to <input>", () => {
    const wrapper = mountInput({ type: "password" });
    const input = wrapper.find("input");

    expect(input.attributes("type")).toBe("password");
  });

  it("binds slotProps from FormField onto the inner <input>", () => {
    const wrapper = mountInput({ id: "user-email", required: true });
    const input = wrapper.find("input");

    expect(input.attributes("id")).toBe("user-email");
    expect(input.attributes("required")).toBeDefined();
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(input.attributes("aria-describedby")).toBe("mock-desc");
  });

  it("forwards extra $attrs to the inner <input> and not the root element (inheritAttrs: false)", () => {
    const wrapper = mountInput(
      {},
      {
        placeholder: "you@example.com",
        autocomplete: "email",
        maxlength: "100",
      },
    );

    expect(wrapper.attributes("placeholder")).toBeUndefined();

    const input = wrapper.find("input");
    expect(input.attributes("placeholder")).toBe("you@example.com");
    expect(input.attributes("autocomplete")).toBe("email");
    expect(input.attributes("maxlength")).toBe("100");
  });

  it("syncs v-model value in both directions", async () => {
    const wrapper = mountInput({ modelValue: "initial" });
    const input = wrapper.find("input");

    expect(input.element.value).toBe("initial");

    await input.setValue("updated");
    expect(wrapper.emitted("update:modelValue")).toEqual([["updated"]]);

    await wrapper.setProps({ modelValue: "from-parent" });
    expect(input.element.value).toBe("from-parent");
  });
});
