import { Page, Layout, Card, BlockStack, Text, Button, Box } from "@shopify/polaris";
import { useState } from "react";

export default function SupportPage() {
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  const faqs = [
    {
      id: "faq1",
      question: "How do I make my upsell widget appear on my store?",
      answer: "You must enable the Beta-Upsell 'App Embed' in your Shopify Theme Editor. You can use the 1-click 'Enable App Embed' button directly on your dashboard, or manually go to Online Store > Themes > Customize > App embeds."
    },
    {
      id: "faq2",
      question: "Where does the 'Frequently Bought Together' widget show up?",
      answer: "It displays on your product pages. You can control exactly where it sits by going to your Theme Editor, navigating to your Default Product template, and dragging the 'FBT Upsell Block' wherever you want (usually right below the Add to Cart button)."
    },
    {
      id: "faq3",
      question: "How do the AI Recommendations work?",
      answer: "When you select a Trigger Product, our AI engine automatically scans your store's collections and price correlations to suggest 3 high-converting upsell products. This takes the guesswork out of building offers!"
    },
    {
      id: "faq4",
      question: "What are the active offer limits?",
      answer: "The Free Plan is limited to 1 active offer at a time. To unlock UNLIMITED active offers and advanced placements (Checkout, Post-Purchase, Thank You page), please upgrade to the Pro plan ($29/mo)."
    },
    {
      id: "faq5",
      question: "What happens when a customer accepts an offer?",
      answer: "For Cart & Product Page offers, the item is instantly added to their cart. For Inline Checkout offers, the cart updates without reloading. For Post-Purchase offers, their credit card is charged instantly without re-entering payment details."
    }
  ];

  return (
    <Page title="Support & FAQ">
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Need help?</Text>
              <Text as="p" variant="bodyMd">
                Can't find the answer you're looking for? Our dedicated support team is available to help you maximize your revenue. We typically respond within 24 hours.
              </Text>
              <Box paddingBlockStart="200">
                <Button url="mailto:hello@adloomx.com" target="_blank" variant="primary">
                  Email Support (hello@adloomx.com)
                </Button>
              </Box>
              <Text as="p" variant="bodyMd">
                <Link to="/app/privacy">Privacy Policy</Link>
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Frequently Asked Questions</Text>
              <Box>
                {faqs.map((faq) => (
                  <div key={faq.id} style={{ borderBottom: '1px solid #ebebeb', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div 
                      onClick={() => toggleFAQ(faq.id)}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text as="h3" variant="headingMd">{faq.question}</Text>
                      <Text as="span" variant="headingMd" tone="subdued">
                        {openFAQ === faq.id ? "−" : "+"}
                      </Text>
                    </div>
                    {openFAQ === faq.id && (
                      <Box paddingBlockStart="300">
                        <Text as="p" variant="bodyMd">{faq.answer}</Text>
                      </Box>
                    )}
                  </div>
                ))}
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
