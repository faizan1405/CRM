import { PrismaClient } from "@prisma/client";
import type { SampleType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Website Packages...");

  const packages = [
    {
      name: "Starter Package",
      price: 6000,
      isStartingPrice: false,
      inclusions: "- One-page website\n- Modern 3D 2026-style design\n- Mobile & desktop responsive\n- Contact / WhatsApp integration\n- 1 Year Free Hosting\n- Domain by customer",
      hosting: "Included for 1 year",
      domain: "Excluded / client side",
      sortOrder: 1,
    },
    {
      name: "Business Package",
      price: 12000,
      isStartingPrice: false,
      inclusions: "- everything in Starter\n- Professional multi-page website\n- Premium responsive UI/UX\n- Contact & enquiry forms\n- Click-to-call\n- Social media integration\n- Basic SEO & SSL\n- 1 Year Free Hosting\n- Domain by customer",
      hosting: "Included for 1 year",
      domain: "Excluded / client side",
      sortOrder: 2,
    },
    {
      name: "E-Commerce Package",
      price: 20000,
      isStartingPrice: true,
      inclusions: "- Complete online store\n- Product & category management\n- Cart & checkout\n- Payment gateway integration\n- Complete admin panel\n- Order management\n- Website security\n- Speed optimization\n- 1 Year Technical Support\n- Hosting & domain by customer",
      hosting: "Client-paid / client-provided",
      domain: "Client side",
      sortOrder: 3,
    },
    {
      name: "Premium E-Commerce Package",
      price: 25000,
      isStartingPrice: true,
      inclusions: "- all E-Commerce features\n- Fully customized premium design\n- Advanced animations & 3D\n- Advanced admin panel\n- Customer login & registration\n- Database integration\n- Lead/enquiry management\n- AI chatbot integration\n- Advanced speed optimization\n- Advanced SEO & security\n- 1 Year Technical Support\n- Hosting & domain by customer",
      hosting: "Client-paid / client-provided",
      domain: "Client side",
      sortOrder: 4,
    },
    {
      name: "Ultimate Website Package",
      price: 40000,
      isStartingPrice: false,
      inclusions: "- all Premium E-Commerce features\n- Fully custom premium website\n- Advanced 3D & interactive experiences\n- Product/order/enquiry management\n- Advanced customer portal\n- Lead management dashboard\n- AI chatbot\n- Advanced SEO\n- Premium speed optimization\n- Advanced security & SSL\n- Google Maps\n- Premium lead-generation forms\n- 1 Year Premium Hosting\n- 1 Year Website Maintenance\n- 1 Year Technical Support\n- Minor content/website updates\n- Bug fixes & technical assistance",
      hosting: "Included for 1 year",
      domain: "Excluded / client side",
      sortOrder: 5,
    },
  ];

  for (const pkg of packages) {
    await prisma.websitePackage.create({ data: pkg });
  }

  console.log("Seeding Website Samples...");

  const samples = [
    { label: "Black Pearl Apparels", url: "https://www.blackpearlapparals.in/", category: "E-Commerce", type: "LIVE" },
    { label: "Mainika", url: "https://www.mainika.com/", category: "E-Commerce", type: "LIVE" },
    { label: "Yaarl Styles", url: "https://www.yaarlstyles.com/", category: "E-Commerce", type: "LIVE" },
    { label: "Teen n Tees", url: "https://www.teenntees.eu/", category: "E-Commerce", type: "LIVE" },
    
    { label: "Ezymiles", url: "https://www.ezymiles.in/", category: "Travel", type: "LIVE" },
    
    { label: "Clickographers", url: "https://www.clickographers.com/", category: "Business / Informative", type: "LIVE" },
    { label: "Southern Lifts", url: "https://southernlifts.com.au/", category: "Business / Informative", type: "LIVE" },
    
    { label: "Rio Property", url: "https://www.rioproperty.co.za/", category: "3D Property", type: "LIVE" },
    
    { label: "VF POC PathTech", url: "https://vf-poc.pathtech.net/", category: "3D Product", type: "LIVE" },

    { label: "Snaccident", url: "https://snaccident.vercel.app/", category: "E-Commerce", type: "DEMO" },
    { label: "E-Commerce Teal", url: "https://e-commerce3-teal.vercel.app/", category: "E-Commerce", type: "DEMO" },
    { label: "E-Commerce Red", url: "https://e-commerce1-red.vercel.app/", category: "E-Commerce", type: "DEMO" },
    { label: "Tuskel Linen", url: "https://tuskel-linen-elevate.vercel.app/", category: "E-Commerce", type: "DEMO" },

    { label: "SS Herbal", url: "https://ss-herbal.vercel.app/", category: "Cosmetic", type: "DEMO" },

    { label: "Travel Sample 1", url: "https://travel-sample1.vercel.app/", category: "Travel", type: "DEMO" },

    { label: "Upside Down", url: "https://upsidedown-flight-path.lovable.app/", category: "Business / Informative", type: "DEMO" },
    { label: "Scrollscape", url: "https://scrollscape-tradexbay.lovable.app/", category: "Business / Informative", type: "DEMO" },

    { label: "Blog Sample 1", url: "https://blog-smpl1.vercel.app/", category: "3D Property", type: "DEMO" },
    { label: "Scrub Magic Canvas", url: "https://scrub-magic-canvas-main.vercel.app/", category: "3D Property", type: "DEMO" },

    { label: "3D Sample 2", url: "https://3d-sample2.vercel.app/", category: "3D Product", type: "DEMO" },
    { label: "3D Sample 1", url: "https://3d-sample1.vercel.app/", category: "3D Product", type: "DEMO" },
  ];

  for (const s of samples) {
    await prisma.websiteSample.create({ data: { ...s, type: s.type as SampleType } });
  }

  console.log("Seeding WhatsApp Templates...");

  const templates = [
    {
      title: "Introduction",
      category: "FIRST_CONTACT",
      message: "Hi {{leadName}} 👋\n\nThis is Faizan from Scale Flow.\n\nWe build modern, fast and conversion-focused websites for businesses.\n\nI wanted to connect regarding your website requirement.\n\nLet me know when you're available and I can share some relevant samples with you.",
      sortOrder: 1,
    },
    {
      title: "Website Samples",
      category: "FOLLOW_UP",
      message: "Hi {{leadName}} 👋\n\nAs discussed, sharing a few relevant website samples from Scale Flow:\n\n{{selectedSampleLinks}}\n\nPlease have a look and let me know which style you like.\n\nI can then suggest the best approach for your website.",
      sortOrder: 2,
    },
    {
      title: "Packages / Pricing",
      category: "FOLLOW_UP",
      message: "Hi {{leadName}} 👋\n\nSharing our website packages:\n\n{{packagePricingLinks}}\n\nI can recommend the right option based on your requirement.\n\nDomain is from the client side.",
      sortOrder: 3,
    },
    {
      title: "Follow-up",
      category: "FOLLOW_UP",
      message: "Hi {{leadName}} 👋\n\nJust following up regarding the website requirement we discussed.\n\nDid you get a chance to check the details/sample I shared?\n\nLet me know if you have any questions and we can take it forward.",
      sortOrder: 4,
    },
    {
      title: "Proposal Follow-up",
      category: "QUOTATION_FOLLOW_UP",
      message: "Hi {{leadName}} 👋\n\nJust following up regarding the website proposal/quotation I shared with you.\n\nPlease let me know if you've reviewed it or if you'd like any changes or clarification.\n\nHappy to discuss it.",
      sortOrder: 5,
    },
    {
      title: "Call-back",
      category: "AFTER_CALL",
      message: "Hi {{leadName}} 👋\n\nI tried reaching you regarding your website requirement.\n\nPlease let me know a convenient time to call you back.",
      sortOrder: 6,
    },
  ];

  for (const t of templates) {
    // @ts-expect-error - Prisma mismatch
    await prisma.whatsAppTemplate.create({ data: t });
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
