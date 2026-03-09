import { NextRequest, NextResponse } from 'next/server';


const getGeoInfo = async (ip: string): Promise<GeoInfo | null> => {
    try {
        const response = await fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`, {
            signal: AbortSignal.timeout(3000)
        });

        if (!response.ok) {
            console.error('GeoJS API error:', response.status);
            return null;
        }

        const data = await response.json();
        return {
            asn: data.asn
        };
    } catch {
        return null;
    }
};

export const proxy = async (req: NextRequest) => {
    const { pathname } = req.nextUrl
    if (!pathname.startsWith('/contact')) {
        return NextResponse.next();
    }
    const currentTime = Date.now();
    const token = req.cookies.get('token')?.value;
    const pathSegments = pathname.split('/');
    const slug = pathSegments[2];

    const isValid = token && slug && Number(slug) - Number(token) < 240000 && currentTime - Number(token) < 240000;

    if (isValid) {
        return NextResponse.next();
    }

    return new NextResponse(null, { status: 404 });
};

export const config = {
    matcher: ['/contact/:path*', '/live']
};
