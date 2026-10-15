import { createContext, useContext } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';

const RestaurantContext = createContext(null);

export function RestaurantLayout() {
    const { restaurantSlug } = useParams();

    return (
        <RestaurantContext.Provider value={restaurantSlug}>
            <Navbar />
            <Outlet />
        </RestaurantContext.Provider>
    );
}

export function useRestaurantSlug() {
    const restaurantSlug = useContext(RestaurantContext);
    if (!restaurantSlug) {
        throw new Error('A restaurant-specific public URL is required.');
    }
    return restaurantSlug;
}

export function restaurantPath(restaurantSlug, suffix = '') {
    return `/customer/${encodeURIComponent(restaurantSlug)}${suffix}`;
}
