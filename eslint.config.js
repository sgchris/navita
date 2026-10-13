import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "src/api/bindings", "node_modules"] },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // @tanstack/react-virtual's hook is flagged by the React Compiler lint; it is used as documented.
      "react-hooks/incompatible-library": "off",
    },
  },
);
