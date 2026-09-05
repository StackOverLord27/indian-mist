import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Subscriber from '@/models/subscriber.model';
import { z } from 'zod';

const subscribeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = subscribeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    await dbConnect();

    const existingSubscriber = await Subscriber.findOne({ email });

    if (existingSubscriber) {
      // If already subscribed, return a success-like message to prevent leaking info
      // or just tell them they are already subscribed.
      return NextResponse.json(
        { message: 'You are already subscribed!' },
        { status: 200 }
      );
    }

    await Subscriber.create({ email });

    return NextResponse.json(
      { message: 'Successfully subscribed to the newsletter!' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { message: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
