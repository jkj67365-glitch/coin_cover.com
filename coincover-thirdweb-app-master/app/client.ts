import { createThirdwebClient } from "thirdweb";

// Get client ID from environment variable
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1983540c2614ac19c06a412e32f7b726";

if (!clientId) {
  throw new Error("No client ID provided");
}

export const client = createThirdwebClient({
  clientId: clientId,
});
