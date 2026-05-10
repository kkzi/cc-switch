import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";
import { CodexFormFields } from "@/components/providers/forms/CodexFormFields";
import { Form } from "@/components/ui/form";
import type { ProviderFormData } from "@/lib/schemas/provider";

function CodexFormFieldsHarness() {
  const form = useForm<ProviderFormData>({
    defaultValues: {
      name: "",
      websiteUrl: "",
      notes: "",
      settingsConfig: "{}",
    },
  });

  return (
    <Form {...form}>
      <form>
        <CodexFormFields
          codexApiKey="sk-test"
          onApiKeyChange={() => {}}
          shouldShowApiKeyLink={false}
          websiteUrl=""
          shouldShowSpeedTest={true}
          codexBaseUrl="https://api.example.com/v1"
          onBaseUrlChange={() => {}}
          isFullUrl={false}
          onFullUrlChange={() => {}}
          isEndpointModalOpen={false}
          onEndpointModalToggle={() => {}}
          autoSelect={true}
          onAutoSelectChange={() => {}}
          shouldShowModelField={true}
          modelName=""
          onModelNameChange={() => {}}
          speedTestEndpoints={[]}
        />
      </form>
    </Form>
  );
}

describe("CodexFormFields", () => {
  it("does not render endpoint or model hint rows in the compact codex form", () => {
    render(<CodexFormFieldsHarness />);

    expect(screen.queryByText("providerForm.codexApiHint")).not.toBeInTheDocument();
    expect(
      screen.queryByText("💡 留空将使用供应商的默认模型"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("指定使用的模型，将自动更新到 config.toml 中"),
    ).not.toBeInTheDocument();
  });

  it("renders endpoint label with the same muted style as the basic provider labels", () => {
    render(<CodexFormFieldsHarness />);

    const endpointLabel = screen.getByText("codexConfig.apiUrlLabel");
    expect(endpointLabel).toHaveClass("font-medium", "leading-8", "text-muted-foreground");
  });
});
