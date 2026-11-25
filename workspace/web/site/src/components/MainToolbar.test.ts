import { shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";
import MainToolbar from "./MainToolbar.vue";

vi.mock("../dialog/ConnectionDialog.vue", () => ({
  default: defineComponent({
    name: "ConnectionDialog",
    template: "<connection-dialog-stub />",
  }),
}));

describe("MainToolbar", () => {
  it("renders the #main-toolbar nav, #logo, and #options containers", () => {
    const wrapper = shallowMount(MainToolbar);

    expect(wrapper.element.tagName).toBe("NAV");
    expect(wrapper.attributes("id")).toBe("main-toolbar");
    expect(wrapper.find("#logo").exists()).toBe(true);
    expect(wrapper.find("#options").exists()).toBe(true);
  });

  it("renders mocked ConnectionDialog inside #options", () => {
    const wrapper = shallowMount(MainToolbar);

    const dialog = wrapper
      .find("#options")
      .findComponent({ name: "ConnectionDialog" });
    expect(dialog.exists()).toBe(true);
  });

  it("renders default slot content inside the inner <nav> within #options", () => {
    const wrapper = shallowMount(MainToolbar, {
      slots: {
        default: "<a href='/settings'>Settings</a>",
      },
    });

    const innerNav = wrapper.find("#options > nav");
    expect(innerNav.exists()).toBe(true);
    expect(innerNav.text()).toBe("Settings");
  });

  it("shallow-stubs child components passed into the default slot", () => {
    const FakeNavItem = defineComponent({
      name: "NavButton",
      template: "<button>Real Button</button>",
    });

    const wrapper = shallowMount(MainToolbar, {
      slots: {
        default: FakeNavItem,
      },
    });

    const innerNav = wrapper.find("#options > nav");
    expect(innerNav.findComponent(FakeNavItem).exists()).toBe(true);
    expect(innerNav.html()).toContain("nav-button-stub");
  });
});
