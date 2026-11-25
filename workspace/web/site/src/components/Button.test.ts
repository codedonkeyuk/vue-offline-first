import { shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";
import Button from "./Button.vue";

vi.mock("vue-router", () => ({
  RouterLink: defineComponent({
    name: "RouterLink",
    props: ["to"],
    template: "<router-link-stub><slot /></router-link-stub>",
  }),
}));

describe("Button", () => {
  it("renders slot content", () => {
    const wrapper = shallowMount(Button, {
      slots: {
        default: "Click me",
      },
    });

    expect(wrapper.text()).toBe("Click me");
  });

  it("renders a native <button> with default classes and no link attributes", () => {
    const wrapper = shallowMount(Button);

    expect(wrapper.element.tagName).toBe("BUTTON");
    expect(wrapper.classes()).toEqual(["btn", "btn--primary", "btn--md"]);
    expect(wrapper.attributes("disabled")).toBeUndefined();
    expect(wrapper.attributes("aria-disabled")).toBeUndefined();
    expect(wrapper.attributes("href")).toBeUndefined();
    expect(wrapper.attributes("to")).toBeUndefined();
  });

  it("renders an <a> tag when `href` is provided", () => {
    const wrapper = shallowMount(Button, {
      props: { href: "https://example.com" },
    });

    expect(wrapper.element.tagName).toBe("A");
    expect(wrapper.attributes("href")).toBe("https://example.com");
    expect(wrapper.attributes("disabled")).toBeUndefined();
  });

  it("renders mocked RouterLink when `to` is provided", () => {
    const route = { name: "home" };
    const wrapper = shallowMount(Button, {
      props: { to: route },
    });

    const link = wrapper.findComponent({ name: "RouterLink" });
    expect(link.exists()).toBe(true);
    expect(link.props("to")).toEqual(route);
    expect(wrapper.attributes("href")).toBeUndefined();
  });

  it("prioritizes `to` over `href`", () => {
    const wrapper = shallowMount(Button, {
      props: {
        to: "/dashboard",
        href: "https://example.com",
      },
    });

    expect(wrapper.findComponent({ name: "RouterLink" }).exists()).toBe(true);
    expect(wrapper.attributes("href")).toBeUndefined();
  });

  it("applies disabled attributes and class on a default button", () => {
    const wrapper = shallowMount(Button, {
      props: { disabled: true },
    });

    expect(wrapper.element.tagName).toBe("BUTTON");
    expect(wrapper.attributes("disabled")).toBeDefined();
    expect(wrapper.attributes("aria-disabled")).toBe("true");
    expect(wrapper.classes()).toContain("is-disabled");
  });

  it("downgrades `href` to a disabled <button> when disabled", () => {
    const wrapper = shallowMount(Button, {
      props: {
        href: "https://example.com",
        disabled: true,
      },
    });

    expect(wrapper.element.tagName).toBe("BUTTON");
    expect(wrapper.attributes("href")).toBeUndefined();
    expect(wrapper.attributes("disabled")).toBeDefined();
    expect(wrapper.attributes("aria-disabled")).toBe("true");
  });

  it("downgrades `to` to a disabled <button> when disabled", () => {
    const wrapper = shallowMount(Button, {
      props: {
        to: "/dashboard",
        disabled: true,
      },
    });

    expect(wrapper.element.tagName).toBe("BUTTON");
    expect(wrapper.findComponent({ name: "RouterLink" }).exists()).toBe(false);
    expect(wrapper.attributes("to")).toBeUndefined();
    expect(wrapper.attributes("disabled")).toBeDefined();
    expect(wrapper.attributes("aria-disabled")).toBe("true");
  });

  it.each([
    { variant: "primary" as const, size: "sm" as const },
    { variant: "secondary" as const, size: "lg" as const },
  ])("applies btn--$variant and btn--$size classes", ({ variant, size }) => {
    const wrapper = shallowMount(Button, {
      props: { variant, size },
    });

    expect(wrapper.classes()).toContain(`btn--${variant}`);
    expect(wrapper.classes()).toContain(`btn--${size}`);
  });
});
