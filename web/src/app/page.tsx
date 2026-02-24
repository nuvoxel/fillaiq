import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import MonitorWeightIcon from "@mui/icons-material/MonitorWeight";
import NfcIcon from "@mui/icons-material/Nfc";
import BarChartIcon from "@mui/icons-material/BarChart";
import DnsIcon from "@mui/icons-material/Dns";

const features = [
  {
    icon: <MonitorWeightIcon sx={{ fontSize: 40 }} />,
    title: "Real-Time Weight Monitoring",
    description:
      "Track filament spool weights continuously with precision load cells. Know exactly how much material you have left.",
  },
  {
    icon: <NfcIcon sx={{ fontSize: 40 }} />,
    title: "NFC Spool Identification",
    description:
      "Tap an NFC tag to instantly identify and register spools. No manual entry or barcode scanning required.",
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 40 }} />,
    title: "Audit Logging & Analytics",
    description:
      "Every spool change is recorded. View usage trends, material consumption, and historical data at a glance.",
  },
  {
    icon: <DnsIcon sx={{ fontSize: 40 }} />,
    title: "Multi-Rack Management",
    description:
      "Scale from a single rack to an entire print farm. Manage all your racks and bays from one dashboard.",
  },
];

const steps = [
  { number: "1", title: "Mount", description: "Place your spool on a FillaIQ rack bay." },
  { number: "2", title: "Tap", description: "Tap the NFC tag to identify the spool." },
  { number: "3", title: "Monitor", description: "Track weight and usage in real time from your dashboard." },
];

export default function LandingPage() {
  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh" }}>
      {/* Hero */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #FF5C2E 0%, #FF8A65 100%)",
          color: "#fff",
          py: { xs: 8, md: 12 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,0.2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 3,
            }}
          >
            <Typography variant="h4" sx={{ color: "#fff", fontWeight: 700 }}>
              F
            </Typography>
          </Box>
          <Typography variant="h2" fontWeight={800} sx={{ mb: 1 }}>
            FillaIQ
          </Typography>
          <Typography variant="h5" sx={{ mb: 2, opacity: 0.9 }}>
            Smart Filament Monitoring for 3D Printing
          </Typography>
          <Typography
            variant="body1"
            sx={{ mb: 4, maxWidth: 520, mx: "auto", opacity: 0.85 }}
          >
            Automatically track spool weights, identify filaments with NFC, and
            never run out of material mid-print again.
          </Typography>
          <Button
            href="/login"
            variant="contained"
            size="large"
            sx={{
              bgcolor: "#fff",
              color: "#FF5C2E",
              fontWeight: 700,
              px: 4,
              py: 1.5,
              borderRadius: 2,
              "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
            }}
          >
            Get Started
          </Button>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography
          variant="h4"
          fontWeight={700}
          textAlign="center"
          sx={{ mb: 1 }}
        >
          Features
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 6 }}
        >
          Everything you need to manage your filament inventory.
        </Typography>
        <Grid container spacing={3}>
          {features.map((f) => (
            <Grid key={f.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 4,
                  textAlign: "center",
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: "#FF5C2E", mb: 2 }}>{f.icon}</Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {f.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* How It Works */}
      <Box sx={{ bgcolor: "grey.50", py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          <Typography
            variant="h4"
            fontWeight={700}
            textAlign="center"
            sx={{ mb: 1 }}
          >
            How It Works
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 6 }}
          >
            Get up and running in three simple steps.
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={4}
            justifyContent="center"
          >
            {steps.map((s) => (
              <Box key={s.number} sx={{ textAlign: "center", flex: 1 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    bgcolor: "#FF5C2E",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                  }}
                >
                  {s.number}
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Bottom CTA */}
      <Box sx={{ py: { xs: 6, md: 10 }, textAlign: "center" }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            Start monitoring your filament
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Sign in to access your dashboard and take control of your filament inventory.
          </Typography>
          <Button
            href="/login"
            variant="contained"
            size="large"
            sx={{ px: 4, py: 1.5, borderRadius: 2, fontWeight: 700 }}
          >
            Sign In
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          textAlign: "center",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          &copy; {new Date().getFullYear()} FillaIQ. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
