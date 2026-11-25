import { shallowMount } from "@vue/test-utils";
import { h } from "vue";
import FormField from "./FormField.vue";

describe("FormField", () => {
  it("renders label linked to id and default non-error state", () => {
    const wrapper = shallowMount(FormField, {
      props: {
        id: "email",
        label: "Email Address",
      },
    });

    expect(wrapper.classes()).toEqual(["field"]);

    const label = wrapper.find("label.field-label");
    expect(label.exists()).toBe(true);
    expect(label.attributes("for")).toBe("email");
    expect(label.text()).toBe("Email Address");
    expect(wrapper.find(".field-required").exists()).toBe(false);
    expect(wrapper.find(".field-error").exists()).toBe(false);
    expect(wrapper.find(".field-help").exists()).toBe(false);
  });

  it("renders required indicator with aria-hidden when required is true", () => {
    const wrapper = shallowMount(FormField, {
      props: {
        id: "username",
        label: "Username",
        required: true,
      },
    });

    const indicator = wrapper.find(".field-required");
    expect(indicator.exists()).toBe(true);
    expect(indicator.attributes("aria-hidden")).toBe("true");
    expect(indicator.text()).toBe("*");
  });

  it("applies field--error class when error prop is true without errorMessage", () => {
    const wrapper = shallowMount(FormField, {
      props: {
        id: "password",
        label: "Password",
        error: true,
      },
    });

    expect(wrapper.classes()).toContain("field--error");
    expect(wrapper.find(".field-error").exists()).toBe(false);
  });

  it("renders errorMessage with aria-live and applies field--error class", () => {
    const wrapper = shallowMount(FormField, {
      props: {
        id: "password",
        label: "Password",
        errorMessage: "Password is too short",
      },
    });

    expect(wrapper.classes()).toContain("field--error");

    const errorEl = wrapper.find("small.field-error");
    expect(errorEl.exists()).toBe(true);
    expect(errorEl.attributes("id")).toBe("password-error");
    expect(errorEl.attributes("aria-live")).toBe("polite");
    expect(errorEl.text()).toBe("Password is too short");
  });

  it("renders helpText with generated help id", () => {
    const wrapper = shallowMount(FormField, {
      props: {
        id: "bio",
        label: "Bio",
        helpText: "Max 160 characters",
      },
    });

    const helpEl = wrapper.find("small.field-help");
    expect(helpEl.exists()).toBe(true);
    expect(helpEl.attributes("id")).toBe("bio-help");
    expect(helpEl.text()).toBe("Max 160 characters");
  });

  describe("Scoped Slot Accessibility Props", () => {
    it("passes clean default slot props when no error or helpText is set", () => {
      let receivedProps: Record<string, unknown> | undefined;

      shallowMount(FormField, {
        props: {
          id: "name",
          label: "Full Name",
        },
        slots: {
          default: (slotProps) => {
            receivedProps = slotProps;
            return h("input", slotProps);
          },
        },
      });

      expect(receivedProps).toEqual({
        id: "name",
        required: false,
        ariaInvalid: undefined,
        ariaDescribedby: undefined,
      });
    });

    it("passes ariaInvalid and combined ariaDescribedby when helpText and errorMessage are both present", () => {
      let receivedProps: Record<string, unknown> | undefined;

      shallowMount(FormField, {
        props: {
          id: "email",
          label: "Email",
          required: true,
          helpText: "We never share your email",
          errorMessage: "Invalid email format",
        },
        slots: {
          default: (slotProps) => {
            receivedProps = slotProps;
            return h("input", slotProps);
          },
        },
      });

      expect(receivedProps).toEqual({
        id: "email",
        required: true,
        ariaInvalid: true,
        ariaDescribedby: "email-help email-error",
      });
    });

    it("passes only help id in ariaDescribedby when only helpText is provided", () => {
      let receivedProps: Record<string, unknown> | undefined;

      shallowMount(FormField, {
        props: {
          id: "email",
          label: "Email",
          error: true,
          helpText: "Enter work email",
        },
        slots: {
          default: (slotProps) => {
            receivedProps = slotProps;
            return h("input", slotProps);
          },
        },
      });

      expect(receivedProps).toEqual({
        id: "email",
        required: false,
        ariaInvalid: true,
        ariaDescribedby: "email-help",
      });
    });
  });
});
