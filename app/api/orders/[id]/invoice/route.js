// app/api/orders/[id]/invoice/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Car from "@/models/Car";
import { corsHeaders, handleOptions } from "@/lib/cors";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/orders/[id]/invoice - Generate and download invoice
export const POST = async (request, { params }) => {
  try {
    await dbConnect();

    // Await params for Next.js 15+
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Find order by orderId
    const order = await Order.findOne({ orderId: id });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Get car details if available
    let carDetails = null;
    if (order.carId) {
      carDetails = await Car.findById(order.carId);
    }

    // Generate PDF invoice
    const pdfBuffer = await generateInvoicePDF(order, carDetails);

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${order.orderId}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Invoice generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate invoice",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
};

// Helper function to generate PDF
async function generateInvoicePDF(order, carDetails) {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
      });

      // Collect PDF chunks
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add company logo (you'll need to add your logo file)
      doc
        .fontSize(20)
        .fillColor("#3b82f6")
        .text("TESLA CARS", { align: "center" })
        .moveDown();

      // Invoice title
      doc
        .fontSize(16)
        .fillColor("#1f2937")
        .text("INVOICE", { align: "center", underline: true })
        .moveDown();

      // Invoice details
      doc.fontSize(10).fillColor("#374151");

      // Left column - Invoice info
      doc.text(`Invoice Number: ${order.orderId}`);
      doc.text(`Invoice Date: ${formatDate(order.createdAt)}`);
      doc.text(`Status: ${order.status.toUpperCase()}`);
      if (order.transactionHash) {
        doc.text(`Transaction: ${order.transactionHash}`);
      }
      doc.moveDown();

      // Draw line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#e5e7eb");
      doc.moveDown();

      // Billing Information
      doc.fontSize(12).fillColor("#1f2937").text("BILL TO:");
      doc.fontSize(10).fillColor("#374151");
      if (order.billingInfo) {
        const billing = order.billingInfo;
        doc.text(billing.name);
        doc.text(billing.email);
        doc.text(billing.phone);
        if (billing.company) doc.text(billing.company);
        doc.text(billing.address);
        doc.text(`${billing.city}, ${billing.state} ${billing.postalCode}`);
        doc.text(billing.country);
      }
      doc.moveDown();

      // Draw line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#e5e7eb");
      doc.moveDown();

      // Order Items Table Header
      doc.fontSize(12).fillColor("#1f2937");
      drawTableRow(
        doc,
        doc.y,
        ["Description", "Quantity", "Unit Price", "Total"],
        true,
      );

      // Order Item
      const item = order.items[0];
      drawTableRow(
        doc,
        doc.y + 20,
        [
          carDetails?.name || item.name || "Vehicle",
          "1",
          formatCurrency(item.price),
          formatCurrency(item.total),
        ],
        false,
      );

      doc.moveDown(2);

      // Payment Method
      doc.text(`Payment Method: ${order.paymentMethod}`);
      if (order.cryptoAmount) {
        doc.text(
          `Cryptocurrency Amount: ${order.cryptoAmount} ${order.paymentCurrency}`,
        );
      }
      doc.moveDown();

      // Draw line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#e5e7eb");
      doc.moveDown();

      // Totals
      const totalsY = doc.y;
      doc.text(`Subtotal:`, 400, totalsY, { align: "right" });
      doc.text(formatCurrency(order.amount), 500, totalsY, { align: "right" });

      doc.text(`Tax:`, 400, totalsY + 20, { align: "right" });
      doc.text("$0.00", 500, totalsY + 20, { align: "right" });

      doc.text(`Total:`, 400, totalsY + 40, { align: "right" });
      doc
        .fontSize(12)
        .fillColor("#059669")
        .text(formatCurrency(order.amount), 500, totalsY + 40, {
          align: "right",
        });

      // Draw line under totals
      doc
        .moveTo(400, totalsY + 50)
        .lineTo(550, totalsY + 50)
        .stroke("#1f2937");

      doc.moveDown(4);

      // Footer
      doc
        .fontSize(8)
        .fillColor("#6b7280")
        .text("Thank you for your purchase!", { align: "center" })
        .text("All sales are final. Digital goods are non-refundable.", {
          align: "center",
        })
        .text("For support, contact: support@teslacars.com", {
          align: "center",
        })
        .text(
          `Generated on: ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          { align: "center" },
        );

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to draw table rows
function drawTableRow(doc, y, columns, isHeader) {
  const columnWidths = [250, 70, 80, 80];
  let x = 50;

  doc.fillColor(isHeader ? "#1f2937" : "#374151");
  doc.font(isHeader ? "Helvetica-Bold" : "Helvetica");

  columns.forEach((column, i) => {
    doc.text(column, x, y, {
      width: columnWidths[i],
      align: i === 0 ? "left" : "right",
    });
    x += columnWidths[i];
  });

  // Draw line under row
  if (isHeader) {
    doc
      .moveTo(50, y + 15)
      .lineTo(550, y + 15)
      .stroke("#1f2937");
  }
}

// Helper function to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Helper function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
