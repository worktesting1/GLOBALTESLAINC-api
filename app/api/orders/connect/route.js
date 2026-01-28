// app/api/orders/connect/route.js
export async function POST(request) {
  try {
    const { guestUserId, actualUserId } = await request.json();

    // Find all orders with guestUserId
    await Order.updateMany({ userId: guestUserId }, { userId: actualUserId });

    return NextResponse.json({
      success: true,
      message: "Orders connected to account",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
