import {Metadata} from "next";
import {buildLocationPlacesMetadata, LocationPlacesRouteProps, renderLocationPlacesPage} from "../_components/location-places-route";

export function generateMetadata(props: LocationPlacesRouteProps): Promise<Metadata> {
    return buildLocationPlacesMetadata(props, "wildlife-reserves");
}

export default function LocationWildlifeReservesPage(props: LocationPlacesRouteProps) {
    return renderLocationPlacesPage(props, "wildlife-reserves");
}
