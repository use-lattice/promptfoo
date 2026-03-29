import React from 'react';

import Head from '@docusaurus/Head';
import { useColorMode } from '@docusaurus/theme-common';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Layout from '@theme/Layout';
import styles from './contact.module.css';

const contactReasons = [
  'AI red teaming and security testing',
  'Guardrails, policy enforcement, and compliance',
  'Prompt and model evals for production teams',
  'Enterprise deployment, SSO, and procurement',
];

const responseExpectations = [
  'A response from our team within one business day',
  'A technical walkthrough tailored to your use case',
  'Deployment guidance for cloud, VPC, or self-hosted environments',
];

function Contact(): React.ReactElement {
  const isDarkTheme = useColorMode().colorMode === 'dark';

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDarkTheme ? 'dark' : 'light',
          primary: {
            main: '#0066cc',
          },
        },
      }),
    [isDarkTheme],
  );

  return (
    <ThemeProvider theme={theme}>
      <Box className={styles.pageWrapper}>
        <Container maxWidth="lg">
          <Box className={styles.heroSection}>
            <Chip label="Enterprise" className={styles.heroChip} size="small" />
            <Typography variant="h2" component="h1" className={styles.heroTitle}>
              Talk to our AI security team
            </Typography>
            <Typography variant="h6" className={styles.heroSubtitle}>
              We help security, platform, and ML teams evaluate risk, enforce policy, and ship
              reliable AI applications.
            </Typography>
          </Box>

          <Box className={styles.mainLayout}>
            <Paper className={styles.contactCard} elevation={0}>
              <Box className={styles.cardHeader}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                  Request a demo
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Tell us about your environment and what you want to accomplish.
                </Typography>
              </Box>

              <form action="https://submit-form.com/ghriv7voL" className={styles.contactForm}>
                <Box className={styles.formGrid}>
                  <TextField
                    fullWidth
                    id="name"
                    name="name"
                    label="Full name"
                    variant="outlined"
                    required
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    id="email"
                    name="email"
                    label="Work email"
                    type="email"
                    variant="outlined"
                    required
                    margin="normal"
                    helperText="Please use your company email address"
                  />
                </Box>

                <Box className={styles.formGrid}>
                  <TextField
                    fullWidth
                    id="company"
                    name="company"
                    label="Company"
                    variant="outlined"
                    required
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    id="title"
                    name="title"
                    label="Job title"
                    variant="outlined"
                    margin="normal"
                  />
                </Box>

                <FormControl fullWidth margin="normal" variant="outlined" required>
                  <InputLabel id="interested-in-label">Area of interest</InputLabel>
                  <Select
                    labelId="interested-in-label"
                    id="interested-in"
                    name="interested-in"
                    label="Area of interest"
                  >
                    <MenuItem value="Enterprise Security">AI red teaming and security</MenuItem>
                    <MenuItem value="AI Guardrails">Guardrails and compliance</MenuItem>
                    <MenuItem value="Model Evaluation">Model evals and testing</MenuItem>
                    <MenuItem value="Custom Solution">Enterprise deployment</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  id="message"
                  name="message"
                  label="How can we help?"
                  multiline
                  rows={5}
                  variant="outlined"
                  required
                  margin="normal"
                  placeholder="Share a few details about your application, timeline, and deployment requirements."
                />

                <Box className={styles.submitRow}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      px: 4,
                      py: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Contact sales
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Or email{' '}
                    <Link href="mailto:inquiries@promptfoo.dev" underline="hover">
                      inquiries@promptfoo.dev
                    </Link>
                  </Typography>
                </Box>
              </form>
            </Paper>

            <Box className={styles.sidebarColumn}>
              <Paper className={styles.sidebarCard} elevation={0}>
                <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: '1rem' }}>
                  Common requests
                </Typography>
                <Box className={styles.bulletList}>
                  {contactReasons.map((reason) => (
                    <Box key={reason} className={styles.bulletItem}>
                      <CheckCircleOutlineIcon className={styles.bulletIcon} />
                      <Typography variant="body2">{reason}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              <Paper className={styles.sidebarCard} elevation={0}>
                <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: '1rem' }}>
                  What to expect
                </Typography>
                <Box className={styles.bulletList}>
                  {responseExpectations.map((item) => (
                    <Box key={item} className={styles.bulletItem}>
                      <CheckCircleOutlineIcon className={styles.bulletIcon} />
                      <Typography variant="body2">{item}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              <Paper className={styles.sidebarCard} elevation={0}>
                <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: '1rem' }}>
                  Trusted by leading teams
                </Typography>
                <Box className={styles.logoGrid}>
                  <img
                    src="/img/brands/shopify-logo.svg"
                    alt="Shopify"
                    className={styles.brandLogo}
                  />
                  <img
                    src="/img/brands/anthropic-logo.svg"
                    alt="Anthropic"
                    className={styles.brandLogo}
                  />
                  <img
                    src="/img/brands/microsoft-logo.svg"
                    alt="Microsoft"
                    className={styles.brandLogo}
                  />
                  <img
                    src="/img/brands/discord-logo-blue.svg"
                    alt="Discord"
                    className={styles.brandLogo}
                  />
                  <img
                    src="/img/brands/doordash-logo.svg"
                    alt="DoorDash"
                    className={styles.brandLogo}
                  />
                  <img
                    src="/img/brands/carvana-logo.svg"
                    alt="Carvana"
                    className={styles.brandLogo}
                  />
                </Box>
              </Paper>

              <Paper className={styles.sidebarCard} elevation={0}>
                <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: '1rem' }}>
                  Resources
                </Typography>
                <Box className={styles.resourceLinks}>
                  <Link
                    href="https://github.com/promptfoo/promptfoo"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.resourceLink}
                    underline="none"
                  >
                    GitHub
                    <ArrowForwardIcon className={styles.resourceLinkIcon} />
                  </Link>
                  <Link
                    href="https://discord.gg/promptfoo"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.resourceLink}
                    underline="none"
                  >
                    Discord community
                    <ArrowForwardIcon className={styles.resourceLinkIcon} />
                  </Link>
                  <Link href="/docs/enterprise" className={styles.resourceLink} underline="none">
                    Enterprise documentation
                    <ArrowForwardIcon className={styles.resourceLinkIcon} />
                  </Link>
                </Box>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default function Page(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  const siteUrl = siteConfig.url;

  return (
    <Layout
      title="Contact Enterprise Sales"
      description="Contact Promptfoo about enterprise AI security solutions, red teaming, guardrails, and compliance."
    >
      <Head>
        <meta property="og:title" content="Contact Promptfoo" />
        <meta
          property="og:description"
          content="Contact Promptfoo about enterprise AI security solutions, red teaming, guardrails, and compliance."
        />
        <meta property="og:image" content={`${siteUrl}/img/og/contact-og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteUrl}/contact`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contact Promptfoo" />
        <meta
          name="twitter:description"
          content="Contact Promptfoo about enterprise AI security solutions, red teaming, guardrails, and compliance."
        />
        <meta name="twitter:image" content={`${siteUrl}/img/og/contact-og.png`} />
        <link rel="canonical" href={`${siteUrl}/contact`} />
      </Head>
      <Contact />
    </Layout>
  );
}
