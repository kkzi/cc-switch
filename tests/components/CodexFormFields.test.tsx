import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";
import { CodexFormFields } from "@/components/providers/forms/CodexFormFields";
import { Form } from "@/components/ui/form";
import type { ProviderFormData } from "@/lib/schemas/provider";
import type { CodexApiFormat } from "@/types";

function CodexFormFieldsHarness({
  apiFormat = "openai_responses",
}: {
  apiFormat?: CodexApiFormat;
}) {
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
          apiFormat={apiFormat}
          catalogModels={[
            {
              model: "deepseek-v4-flash",
              displayName: "DeepSeek V4 Flash",
              contextWindow: 128000,
            },
          ]}
          onCatalogModelsChange={() => {}}
          modelName="gpt-5.4"
          onModelNameChange={() => {}}
          onFetchModels={() => {}}
          modelSuggestions={["gpt-5.4", "deepseek-v4-flash"]}
          speedTestEndpoints={[]}
        />
      </form>
    </Form>
  );
}

describe("CodexFormFields", () => {
  it("does not render the removed Responses endpoint hint", () => {
    render(<CodexFormFieldsHarness />);

    expect(
      screen.queryByText("providerForm.codexApiHint"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("💡 填写兼容 OpenAI Response 格式的服务端点地址"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("💡 留空将使用供应商的默认模型"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("指定使用的模型，将自动更新到 config.toml 中"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("providerForm.autoFetchModels"),
    ).not.toBeInTheDocument();
  });

  it("renders the model name row and hides the local routing card", () => {
    render(<CodexFormFieldsHarness />);

    expect(
      screen.getByText(/模型名称|codexConfig\.modelName/),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("gpt-5.4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /获取模型|providerForm\.fetchModels/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/需要本地路由映射|Needs Local Routing/),
    ).not.toBeInTheDocument();
  });

  it("renders endpoint label with the same muted style as the basic provider labels", () => {
    render(<CodexFormFieldsHarness />);

    const endpointLabel = screen.getByText("codexConfig.apiUrlLabel");
    expect(endpointLabel).toHaveClass(
      "font-medium",
      "leading-8",
      "text-muted-foreground",
    );
  });

  it("renders the fork model mapping editor in local routing mode", () => {
    render(<CodexFormFieldsHarness apiFormat="openai_chat" />);

    expect(
      screen.getByText(/模型映射|codexConfig\.modelMappingTitle/),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("DeepSeek V4 Flash")).toBeInTheDocument();
    expect(screen.getByDisplayValue("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByDisplayValue("128000")).toBeInTheDocument();
  });
});
